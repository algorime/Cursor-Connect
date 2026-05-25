import {
	type AuthHandoffResponse,
	type AuthPollResponse,
	AUTH_FAILURE_BODY,
	type CodexAuthState,
	type InternalControlPingResponse,
	type InternalStatusResponse,
	type SafeLogEvent
} from '@codex-auth-ext/shared';
import type { FastifyPluginCallback } from 'fastify';

import {
	authenticateInternalControl,
	rejectIfLocalApiKeyUsedOnInternalRoute
} from '../auth/api-auth-boundary.js';
import type { PendingAuthQueue } from '../auth-handoff/pending-auth-requests.js';
import type { ReadinessState } from '../state/readiness-state.js';
import type { UsageStore } from '../usage/usage-store.js';

export interface InternalControlRouteOptions {
	localApiKey: string;
	internalControlSecret: string;
	readinessState: ReadinessState;
	authQueue: PendingAuthQueue;
	usageStore?: UsageStore;
	onAuthFailure?: (event: SafeLogEvent) => void;
}

const plugin: FastifyPluginCallback<InternalControlRouteOptions> = (app, opts, done) => {
	app.get('/internal/control/ping', async (request, reply) => {
		const localReject = rejectIfLocalApiKeyUsedOnInternalRoute(
			request.headers,
			opts.localApiKey,
			opts.onAuthFailure
		);

		if (!localReject.ok) {
			return reply.status(localReject.statusCode).send(localReject.body);
		}

		const auth = authenticateInternalControl(request.headers, {
			internalControlSecret: opts.internalControlSecret,
			onAuthFailure: opts.onAuthFailure
		});

		if (!auth.ok) {
			return reply.status(auth.statusCode).send(auth.body);
		}

		opts.readinessState.markControlAuthenticated();
		opts.readinessState.markAuthHandoffConnected(opts.authQueue.hasConnectedPoll());

		const body: InternalControlPingResponse = {
			ok: true
		};

		return reply.send(body);
	});

	app.get('/internal/status', async (request, reply) => {
		const auth = authenticateInternalRequest(request.headers, opts);

		if (!auth.ok) {
			return reply.status(auth.statusCode).send(auth.body);
		}

		const body: InternalStatusResponse = opts.readinessState.getInternalStatus();
		return reply.send(body);
	});

	app.get('/internal/auth-requests', async (request, reply) => {
		const auth = authenticateInternalRequest(request.headers, opts);

		if (!auth.ok) {
			return reply.status(auth.statusCode).send(auth.body);
		}

		const waitMs = readWaitMs(request.query);
		opts.readinessState.markAuthHandoffConnected(true);
		const pending = await opts.authQueue.poll(waitMs);

		const body: AuthPollResponse = {
			request: pending
		};

		return reply.send(body);
	});

	app.post<{ Params: { id: string }; Body: AuthHandoffResponse }>(
		'/internal/auth-requests/:id/response',
		async (request, reply) => {
			const auth = authenticateInternalRequest(request.headers, opts);

			if (!auth.ok) {
				return reply.status(auth.statusCode).send(auth.body);
			}

			const accepted = opts.authQueue.respond(request.params.id, request.body);
			if (request.body.ok) {
				opts.readinessState.setCodexAuthState('authenticated');
			} else if (request.body.code === 'account_id_missing') {
				opts.readinessState.setCodexAuthState('account_id_missing');
			} else if (request.body.code === 'auth_refresh_failed') {
				opts.readinessState.setCodexAuthState('auth_refresh_failed');
			} else if (request.body.code === 'auth_required' || request.body.code === 'auth_unavailable') {
				opts.readinessState.setCodexAuthState('auth_required');
			}

			return reply.status(accepted ? 200 : 404).send({ ok: accepted });
		}
	);

	app.post<{ Body: { codexAuthState: CodexAuthState } }>(
		'/internal/auth/status',
		async (request, reply) => {
			const auth = authenticateInternalRequest(request.headers, opts);

			if (!auth.ok) {
				return reply.status(auth.statusCode).send(auth.body);
			}

			opts.readinessState.setCodexAuthState(request.body.codexAuthState);
			opts.readinessState.markAuthHandoffConnected(opts.authQueue.hasConnectedPoll());

			return reply.send({ ok: true });
		}
	);

	app.get('/internal/usage/records', async (request, reply) => {
		const auth = authenticateInternalRequest(request.headers, opts);

		if (!auth.ok) {
			return reply.status(auth.statusCode).send(auth.body);
		}

		return reply.send({ records: opts.usageStore?.list() ?? [] });
	});

	done();
};

export default plugin;

export { AUTH_FAILURE_BODY };

function authenticateInternalRequest(
	headers: Record<string, string | string[] | undefined>,
	opts: InternalControlRouteOptions
): { ok: true } | { ok: false; statusCode: 401 | 403; body: typeof AUTH_FAILURE_BODY } {
	const localReject = rejectIfLocalApiKeyUsedOnInternalRoute(
		headers,
		opts.localApiKey,
		opts.onAuthFailure
	);

	if (!localReject.ok) {
		return localReject;
	}

	return authenticateInternalControl(headers, {
		internalControlSecret: opts.internalControlSecret,
		onAuthFailure: opts.onAuthFailure
	});
}

function readWaitMs(query: unknown): number {
	if (!query || typeof query !== 'object' || !('waitMs' in query)) {
		return 15_000;
	}

	const waitMs = Number((query as { waitMs?: unknown }).waitMs);

	if (!Number.isFinite(waitMs)) {
		return 15_000;
	}

	return Math.max(0, Math.min(waitMs, 30_000));
}
