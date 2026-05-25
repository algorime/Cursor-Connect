import { HEALTH_RESPONSE } from '@codex-auth-ext/shared';
import type { FastifyPluginCallback } from 'fastify';

const plugin: FastifyPluginCallback = (app, _opts, done) => {
	app.get('/health', async (_request, reply) => {
		return reply.send(HEALTH_RESPONSE);
	});

	done();
};

export default plugin;
