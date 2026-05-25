import { generateSecret, type SafeLogEvent, type UsageRecord } from '@codex-auth-ext/shared';
import type { FastifyPluginCallback } from 'fastify';

import {
	authenticateLocalApiKey,
	rejectIfInternalSecretUsedOnCursorRoute
} from '../auth/api-auth-boundary.js';
import type { PendingAuthQueue } from '../auth-handoff/pending-auth-requests.js';
import {
	CodexUpstreamAuthError,
	CodexUpstreamClient,
	CodexUpstreamHttpError
} from '../codex/codex-upstream-client.js';
import { adaptCursorRequestToCodexResponses } from '../protocol/cursor-request-adapter.js';
import { encodeDone, encodeSseData } from '../protocol/sse.js';
import { superviseResponsesEvents } from '../protocol/responses-stream-supervisor.js';
import type { ReadinessState } from '../state/readiness-state.js';
import type { UsageStore } from '../usage/usage-store.js';
import type { ModelRoutingSettings } from '../models/codex-model-policy.js';
import type { FakeCodexScenario } from '../codex/fake-codex-upstream.js';

export interface ChatCompletionsRouteOptions {
	localApiKey: string;
	internalControlSecret: string;
	modelRoutingSettings: ModelRoutingSettings;
	readinessState: ReadinessState;
	authQueue: PendingAuthQueue;
	usageStore: UsageStore;
	fakeScenario?: FakeCodexScenario | 'auth_401_then_success';
	upstreamFetch?: typeof fetch;
	upstreamResponsesUrl?: string;
	onAuthFailure?: (event: SafeLogEvent) => void;
}

const plugin: FastifyPluginCallback<ChatCompletionsRouteOptions> = (app, opts, done) => {
	app.post('/v1/chat/completions', async (request, reply) => {
		const startedAt = Date.now();
		const authFailure = authenticateCursorRoute(request.headers, opts);

		if (!authFailure.ok) {
			return reply.status(authFailure.statusCode).send(authFailure.body);
		}

		if (!opts.readinessState.isReady()) {
			return reply.status(503).send(openAiError('service_not_ready', 'service_not_ready'));
		}

		const adapted = adaptCursorRequestToCodexResponses(request.body, opts.modelRoutingSettings);

		if (!adapted.ok) {
			return reply
				.status(adapted.statusCode)
				.send(openAiError(adapted.errorCode, adapted.errorCategory));
		}

		try {
			const upstream = new CodexUpstreamClient({
				authQueue: opts.authQueue,
				scenario: opts.fakeScenario,
				fetchImpl: opts.upstreamFetch,
				responsesUrl: opts.upstreamResponsesUrl
			});
			const upstreamResult = await upstream.sendResponsesRequest(adapted.upstreamRequest);
			const supervised = superviseResponsesEvents(upstreamResult.events, {
				model: adapted.route.upstreamModelId
			});
			const usageRecord: UsageRecord = {
				id: generateSecret(12),
				timestamp: startedAt,
				latencyMs: Date.now() - startedAt,
				status: supervised.error ? 'failed' : 'completed',
				cursorFacingModelId: adapted.route.cursorFacingModelId,
				upstreamModelId: adapted.route.upstreamModelId,
				requestShape: adapted.requestShape,
				localAccountKey: upstreamResult.authContext.localAccountKey,
				inputTokens: supervised.usage?.prompt_tokens,
				cachedInputTokens: supervised.usage?.prompt_tokens_details?.cached_tokens,
				outputTokens: supervised.usage?.completion_tokens,
				reasoningTokens: supervised.usage?.completion_tokens_details?.reasoning_tokens,
				totalTokens: supervised.usage?.total_tokens,
				finishReason: supervised.finishReason,
				outputStarted: supervised.outputStarted,
				errorCategory: supervised.error?.category ?? 'none',
				errorCode: supervised.error?.code
			};
			opts.usageStore.record(usageRecord);

			if (supervised.error) {
				return reply
					.status(supervised.outputStarted ? 200 : 502)
					.header('content-type', 'text/event-stream')
					.send(`${encodeSseData(openAiError(supervised.error.code, supervised.error.category))}${encodeDone()}`);
			}

			const stream = `${supervised.chunks.map(encodeSseData).join('')}${encodeDone()}`;
			return reply.header('content-type', 'text/event-stream').send(stream);
		} catch (error) {
			const code = error instanceof CodexUpstreamAuthError ? error.code : 'upstream_failure';
			const category = classifyThrownError(error);
			opts.usageStore.record({
				id: generateSecret(12),
				timestamp: startedAt,
				latencyMs: Date.now() - startedAt,
				status: 'failed',
				cursorFacingModelId: adapted.route.cursorFacingModelId,
				upstreamModelId: adapted.route.upstreamModelId,
				requestShape: adapted.requestShape,
				localAccountKey: null,
				outputStarted: false,
				errorCategory: category,
				errorCode: code
			});
			return reply
				.status(error instanceof CodexUpstreamAuthError ? 401 : 502)
				.send(openAiError(code, category));
		}
	});

	done();
};

export default plugin;

function authenticateCursorRoute(
	headers: Record<string, string | string[] | undefined>,
	opts: ChatCompletionsRouteOptions
): { ok: true } | { ok: false; statusCode: 401 | 403; body: { error: 'unauthorized' } } {
	const internalReject = rejectIfInternalSecretUsedOnCursorRoute(
		headers,
		opts.internalControlSecret,
		opts.onAuthFailure
	);

	if (!internalReject.ok) {
		return internalReject;
	}

	return authenticateLocalApiKey(headers, {
		localApiKey: opts.localApiKey,
		onAuthFailure: opts.onAuthFailure
	});
}

function classifyThrownError(error: unknown): 'auth' | 'provider' | 'rate_limit' | 'quota' {
	if (error instanceof CodexUpstreamAuthError) {
		return 'auth';
	}

	if (error instanceof CodexUpstreamHttpError) {
		if (error.status === 402) {
			return 'quota';
		}
		if (error.status === 429) {
			return 'rate_limit';
		}
	}

	return 'provider';
}

function openAiError(code: string, category: string): { error: { message: string; type: string; code: string } } {
	return {
		error: {
			message: 'request failed',
			type: category,
			code
		}
	};
}
