import {
	AUTH_FAILURE_BODY,
	type ReadyResponse,
	type SafeLogEvent
} from '@codex-auth-ext/shared';
import type { FastifyPluginCallback } from 'fastify';

import {
	authenticateLocalApiKey,
	rejectIfInternalSecretUsedOnCursorRoute
} from '../auth/api-auth-boundary.js';
import type { ReadinessState } from '../state/readiness-state.js';

export interface ReadyRouteOptions {
	localApiKey: string;
	internalControlSecret: string;
	readinessState: ReadinessState;
	onAuthFailure?: (event: SafeLogEvent) => void;
}

const plugin: FastifyPluginCallback<ReadyRouteOptions> = (app, opts, done) => {
	app.get('/ready', async (request, reply) => {
		const internalReject = rejectIfInternalSecretUsedOnCursorRoute(
			request.headers,
			opts.internalControlSecret,
			opts.onAuthFailure
		);

		if (!internalReject.ok) {
			return reply.status(internalReject.statusCode).send(internalReject.body);
		}

		const auth = authenticateLocalApiKey(request.headers, {
			localApiKey: opts.localApiKey,
			onAuthFailure: opts.onAuthFailure
		});

		if (!auth.ok) {
			return reply.status(auth.statusCode).send(auth.body);
		}

		const body: ReadyResponse = {
			ready: opts.readinessState.isReady()
		};

		return reply.send(body);
	});

	done();
};

export default plugin;

export { AUTH_FAILURE_BODY };
