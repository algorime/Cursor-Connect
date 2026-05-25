import {
	AUTH_FAILURE_BODY,
	type InternalControlPingResponse,
	type SafeLogEvent
} from '@codex-auth-ext/shared';
import type { FastifyPluginCallback } from 'fastify';

import {
	authenticateInternalControl,
	rejectIfLocalApiKeyUsedOnInternalRoute
} from '../auth/api-auth-boundary.js';
import type { ReadinessState } from '../state/readiness-state.js';

export interface InternalControlRouteOptions {
	localApiKey: string;
	internalControlSecret: string;
	readinessState: ReadinessState;
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

		const body: InternalControlPingResponse = {
			ok: true
		};

		return reply.send(body);
	});

	done();
};

export default plugin;

export { AUTH_FAILURE_BODY };
