import { Readable } from 'node:stream';

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
import { ResponsesStreamSupervisor } from '../protocol/responses-stream-supervisor.js';
import { emitSafeLog } from '../logger/safe-logger.js';
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

		const adapted = adaptCursorRequestToCodexResponses(request.body, opts.modelRoutingSettings, request.headers);

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
			const supervisor = new ResponsesStreamSupervisor({
				model: adapted.route.upstreamModelId
			});

			const stream = Readable.from((async function* () {
				for await (const event of upstreamResult.eventStream) {
					for (const chunk of supervisor.handleEvent(event)) {
						yield encodeSseData(chunk);
					}
					if (supervisor.isDone) {
						break;
					}
				}

				for (const chunk of supervisor.finish()) {
					yield encodeSseData(chunk);
				}

				const supervised = supervisor.snapshot();
				if (supervised.error && supervised.chunks.length === 0) {
					yield encodeSseData(openAiError(supervised.error.code, supervised.error.category));
				}

				yield encodeDone();
				opts.usageStore.record(usageRecordFromSupervised({
					startedAt,
					supervised,
					cursorFacingModelId: adapted.route.cursorFacingModelId,
					upstreamModelId: adapted.route.upstreamModelId,
					requestShape: adapted.requestShape,
					localAccountKey: upstreamResult.authContext.localAccountKey
				}));
			})());
			return reply
				.header('content-type', 'text/event-stream')
				.header('cache-control', 'no-cache')
				.send(stream);
		} catch (error) {
			const code = classifyThrownErrorCode(error);
			const category = classifyThrownError(error);
			const statusCode = statusCodeForThrownError(error);
			const upstreamStatus = error instanceof CodexUpstreamHttpError ? error.status : undefined;
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
			emitSafeLog({
				component: 'api',
				eventType: 'api.response',
				severity: 'warn',
				timestamp: Date.now(),
				message: 'cursor-facing request failed',
				method: request.method,
				path: '/v1/chat/completions',
				statusCode,
				errorCategory: category,
				errorCode: code,
				upstreamStatus
			});
			return reply
				.status(statusCode)
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

function usageRecordFromSupervised(input: {
	startedAt: number;
	supervised: ReturnType<ResponsesStreamSupervisor['snapshot']>;
	cursorFacingModelId: string;
	upstreamModelId: string;
	requestShape: 'responses' | 'chat_completions';
	localAccountKey: string;
}): UsageRecord {
	const { supervised } = input;

	return {
		id: generateSecret(12),
		timestamp: input.startedAt,
		latencyMs: Date.now() - input.startedAt,
		status: supervised.error ? 'failed' : 'completed',
		cursorFacingModelId: input.cursorFacingModelId,
		upstreamModelId: input.upstreamModelId,
		requestShape: input.requestShape,
		localAccountKey: input.localAccountKey,
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
}

function classifyThrownError(error: unknown): 'auth' | 'provider' | 'rate_limit' | 'quota' | 'invalid_request' {
	if (error instanceof CodexUpstreamAuthError) {
		return 'auth';
	}

	if (error instanceof CodexUpstreamHttpError) {
		if (error.status === 400) {
			return 'invalid_request';
		}
		if (error.status === 401) {
			return 'auth';
		}
		if (error.status === 402) {
			return 'quota';
		}
		if (error.status === 429) {
			return 'rate_limit';
		}
	}

	return 'provider';
}

function statusCodeForThrownError(error: unknown): number {
	if (error instanceof CodexUpstreamAuthError) {
		return 401;
	}

	if (error instanceof CodexUpstreamHttpError) {
		if ([400, 401, 402, 429].includes(error.status)) {
			return error.status;
		}
	}

	return 502;
}

function classifyThrownErrorCode(error: unknown): string {
	if (error instanceof CodexUpstreamAuthError) {
		return error.code;
	}

	if (error instanceof CodexUpstreamHttpError) {
		return `upstream_http_${error.status}`;
	}

	return 'upstream_failure';
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
