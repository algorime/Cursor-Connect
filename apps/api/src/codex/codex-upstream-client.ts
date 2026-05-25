import type { AuthHandoffResponse, RequestScopedAuthContext } from '@codex-auth-ext/shared';

import { PendingAuthQueue } from '../auth-handoff/pending-auth-requests.js';
import { fakeCodexEventsForScenario, type FakeCodexScenario } from './fake-codex-upstream.js';
import { parseSseEvents } from '../protocol/sse.js';

export interface CodexUpstreamAttemptResult {
	events: Array<Record<string, unknown>>;
	authContext: RequestScopedAuthContext;
	refreshedAfter401: boolean;
}

export interface CodexUpstreamClientOptions {
	authQueue: PendingAuthQueue;
	scenario?: FakeCodexScenario | 'auth_401_then_success';
	fetchImpl?: typeof fetch;
	responsesUrl?: string;
}

export class CodexUpstreamClient {
	constructor(private readonly options: CodexUpstreamClientOptions) {}

	async sendResponsesRequest(request: Record<string, unknown>): Promise<CodexUpstreamAttemptResult> {
		const auth = await this.options.authQueue.requestAuth('normal');
		const context = unwrapAuth(auth);

		if (this.options.scenario) {
			if (this.options.scenario === 'auth_401_then_success') {
				const refreshed = await this.options.authQueue.requestAuth('forced_refresh_after_401');
				return {
					events: fakeCodexEventsForScenario('success_text'),
					authContext: unwrapAuth(refreshed),
					refreshedAfter401: true
				};
			}

			return {
				events: fakeCodexEventsForScenario(this.options.scenario),
				authContext: context,
				refreshedAfter401: false
			};
		}

		const first = await this.postResponses(request, context);

		if (first.status === 401) {
			const refreshed = await this.options.authQueue.requestAuth('forced_refresh_after_401');
			const refreshedContext = unwrapAuth(refreshed);
			const retried = await this.postResponses(request, refreshedContext);

			if (!retried.ok) {
				throw new CodexUpstreamHttpError(retried.status);
			}

			return {
				events: parseSseEvents(await retried.response.text()),
				authContext: refreshedContext,
				refreshedAfter401: true
			};
		}

		if (!first.ok) {
			throw new CodexUpstreamHttpError(first.status);
		}

		return {
			events: parseSseEvents(await first.response.text()),
			authContext: context,
			refreshedAfter401: false
		};
	}

	private async postResponses(
		request: Record<string, unknown>,
		context: RequestScopedAuthContext
	): Promise<{ ok: boolean; status: number; response: Response }> {
		const response = await (this.options.fetchImpl ?? fetch)(
			this.options.responsesUrl ?? 'https://chatgpt.com/backend-api/codex/responses',
			{
				method: 'POST',
				headers: {
					authorization: `Bearer ${context.accessToken}`,
					accept: 'text/event-stream',
					'content-type': 'application/json',
					originator: 'codex_cli_rs',
					...context.upstreamHeaders
				},
				body: JSON.stringify(request)
			}
		);

		return {
			ok: response.ok,
			status: response.status,
			response
		};
	}
}

function unwrapAuth(response: AuthHandoffResponse): RequestScopedAuthContext {
	if (!response.ok) {
		throw new CodexUpstreamAuthError(response.code, response.message);
	}

	return response.context;
}

export class CodexUpstreamAuthError extends Error {
	constructor(
		readonly code: string,
		message: string
	) {
		super(message);
	}
}

export class CodexUpstreamHttpError extends Error {
	constructor(readonly status: number) {
		super('Codex upstream request failed');
	}
}
