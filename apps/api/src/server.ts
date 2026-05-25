import { LOOPBACK_HOST } from '@codex-auth-ext/shared';
import Fastify from 'fastify';

import healthPlugin from './routes/health.js';
import internalControlPlugin from './routes/internal-control.js';
import readyPlugin from './routes/ready.js';
import { ReadinessState } from './state/readiness-state.js';

export interface ApiServerConfig {
	host?: string;
	port: number;
	localApiKey: string;
	internalControlSecret: string;
}

export interface ApiServerHandle {
	app: ReturnType<typeof Fastify>;
	readinessState: ReadinessState;
}

export function createApiServer(config: ApiServerConfig): ApiServerHandle {
	const readinessState = new ReadinessState(Boolean(config.internalControlSecret));

	const app = Fastify({
		logger: false,
		bodyLimit: 1024 * 1024
	});

	app.register(healthPlugin);
	app.register(readyPlugin, {
		localApiKey: config.localApiKey,
		internalControlSecret: config.internalControlSecret,
		readinessState
	});
	app.register(internalControlPlugin, {
		localApiKey: config.localApiKey,
		internalControlSecret: config.internalControlSecret,
		readinessState
	});

	return { app, readinessState };
}

export async function startApiServer(config: ApiServerConfig): Promise<ApiServerHandle> {
	const handle = createApiServer(config);

	await handle.app.listen({
		host: config.host ?? LOOPBACK_HOST,
		port: config.port
	});

	return handle;
}

export function readApiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ApiServerConfig {
	const port = Number(env.CODEX_AUTH_EXT_PORT);
	const localApiKey = env.CODEX_AUTH_EXT_LOCAL_API_KEY ?? '';
	const internalControlSecret = env.CODEX_AUTH_EXT_INTERNAL_CONTROL_SECRET ?? '';

	if (!Number.isInteger(port) || port <= 0) {
		throw new Error('CODEX_AUTH_EXT_PORT is required');
	}

	if (!localApiKey) {
		throw new Error('CODEX_AUTH_EXT_LOCAL_API_KEY is required');
	}

	if (!internalControlSecret) {
		throw new Error('CODEX_AUTH_EXT_INTERNAL_CONTROL_SECRET is required');
	}

	return {
		host: env.CODEX_AUTH_EXT_HOST ?? LOOPBACK_HOST,
		port,
		localApiKey,
		internalControlSecret
	};
}
