import type { ModelsResponse, SafeLogEvent } from '@codex-auth-ext/shared';
import type { FastifyPluginCallback } from 'fastify';

import {
	authenticateLocalApiKey,
	rejectIfInternalSecretUsedOnCursorRoute
} from '../auth/api-auth-boundary.js';
import { listSupportedModels, type ModelRoutingSettings } from '../models/codex-model-policy.js';

export interface ModelsRouteOptions {
	localApiKey: string;
	internalControlSecret: string;
	modelRoutingSettings: ModelRoutingSettings;
	onAuthFailure?: (event: SafeLogEvent) => void;
}

const plugin: FastifyPluginCallback<ModelsRouteOptions> = (app, opts, done) => {
	app.get('/v1/models', async (request, reply) => {
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

		const body: ModelsResponse = {
			object: 'list',
			data: listSupportedModels(opts.modelRoutingSettings)
		};

		return reply.send(body);
	});

	done();
};

export default plugin;
