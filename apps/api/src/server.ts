import { LOOPBACK_HOST } from '@codex-auth-ext/shared';
import Fastify from 'fastify';

import { PendingAuthQueue } from './auth-handoff/pending-auth-requests.js';
import type { FakeCodexScenario } from './codex/fake-codex-upstream.js';
import { emitCursorFacingRequestLog } from './logger/request-logger.js';
import healthPlugin from './routes/health.js';
import chatCompletionsPlugin from './routes/chat-completions.js';
import internalControlPlugin from './routes/internal-control.js';
import modelsPlugin from './routes/models.js';
import readyPlugin from './routes/ready.js';
import { ReadinessState } from './state/readiness-state.js';
import { InMemoryUsageStore, type UsageStore } from './usage/usage-store.js';
import { SqliteUsageStore } from './usage/sqlite-usage-store.js';
import { readModelRoutingSettingsFromEnv, type ModelRoutingSettings } from './models/codex-model-policy.js';

export interface ApiServerConfig {
	host?: string;
	port: number;
	localApiKey: string;
	internalControlSecret: string;
	gpt54ToGpt55WorkaroundEnabled?: boolean;
	modelRoutingSettings?: ModelRoutingSettings;
	fakeCodexScenario?: FakeCodexScenario | 'auth_401_then_success';
	upstreamFetch?: typeof fetch;
	upstreamResponsesUrl?: string;
	usageStore?: UsageStore;
	usageDbPath?: string;
	authHandoffLeaseMs?: number;
	now?: () => number;
}

export interface ApiServerHandle {
	app: ReturnType<typeof Fastify>;
	readinessState: ReadinessState;
	authQueue: PendingAuthQueue;
	usageStore: UsageStore;
}

export function createApiServer(config: ApiServerConfig): ApiServerHandle {
	const readinessState = new ReadinessState(Boolean(config.internalControlSecret), {
		now: config.now,
		authHandoffLeaseMs: config.authHandoffLeaseMs
	});
	const authQueue = new PendingAuthQueue();
	const usageStore: UsageStore = config.usageStore ?? new InMemoryUsageStore();
	const modelRoutingSettings = config.modelRoutingSettings ?? {
		gpt54ToGpt55WorkaroundEnabled: config.gpt54ToGpt55WorkaroundEnabled ?? false
	};
	readinessState.setModelPolicyState(
		modelRoutingSettings.gpt54ToGpt55WorkaroundEnabled ? 'workaround_enabled' : 'workaround_disabled'
	);
	if (!config.usageStore && config.usageDbPath) {
		readinessState.setUsageStorageState('degraded');
	}

	const app = Fastify({
		logger: false,
		bodyLimit: 1024 * 1024
	});

	app.addHook('onRequest', (request, _reply, done) => {
		emitCursorFacingRequestLog(request);
		done();
	});

	app.register(healthPlugin);
	app.register(readyPlugin, {
		localApiKey: config.localApiKey,
		internalControlSecret: config.internalControlSecret,
		readinessState
	});
	app.register(modelsPlugin, {
		localApiKey: config.localApiKey,
		internalControlSecret: config.internalControlSecret,
		modelRoutingSettings
	});
	app.register(chatCompletionsPlugin, {
		localApiKey: config.localApiKey,
		internalControlSecret: config.internalControlSecret,
		modelRoutingSettings,
		readinessState,
		authQueue,
		usageStore,
		fakeScenario: config.fakeCodexScenario,
		upstreamFetch: config.upstreamFetch,
		upstreamResponsesUrl: config.upstreamResponsesUrl
	});
	app.register(internalControlPlugin, {
		localApiKey: config.localApiKey,
		internalControlSecret: config.internalControlSecret,
		readinessState,
		authQueue,
		usageStore
	});
	app.addHook('onClose', async () => {
		await usageStore.close?.();
	});

	return { app, readinessState, authQueue, usageStore };
}

export async function startApiServer(config: ApiServerConfig): Promise<ApiServerHandle> {
	const { usageStore, usageStorageState } = await createRuntimeUsageStore(config);
	const handle = createApiServer({
		...config,
		usageStore
	});
	handle.readinessState.setUsageStorageState(usageStorageState);

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
		internalControlSecret,
		modelRoutingSettings: readModelRoutingSettingsFromEnv(env),
		fakeCodexScenario: readFakeScenario(env),
		upstreamResponsesUrl: env.CODEX_AUTH_EXT_CODEX_RESPONSES_URL,
		usageDbPath: env.CODEX_AUTH_EXT_USAGE_DB_PATH
	};
}

async function createRuntimeUsageStore(
	config: ApiServerConfig
): Promise<{ usageStore: UsageStore; usageStorageState: 'ready' | 'degraded' }> {
	if (config.usageStore) {
		return {
			usageStore: config.usageStore,
			usageStorageState: 'ready'
		};
	}

	if (!config.usageDbPath) {
		return {
			usageStore: new InMemoryUsageStore(),
			usageStorageState: 'ready'
		};
	}

	try {
		return {
			usageStore: await SqliteUsageStore.open(config.usageDbPath),
			usageStorageState: 'ready'
		};
	} catch {
		return {
			usageStore: new InMemoryUsageStore(),
			usageStorageState: 'degraded'
		};
	}
}

function readFakeScenario(env: NodeJS.ProcessEnv): FakeCodexScenario | 'auth_401_then_success' | undefined {
	const value = env.CODEX_AUTH_EXT_FAKE_CODEX_SCENARIO;
	const scenarios = new Set<string>([
		'success_text',
		'success_tool',
		'hidden_reasoning',
		'response_failed',
		'response_incomplete',
		'hard_quota',
		'transient_rate_limit',
		'context_length',
		'provider_failure',
		'stream_close',
		'auth_401_then_success'
	]);

	return value && scenarios.has(value)
		? (value as FakeCodexScenario | 'auth_401_then_success')
		: undefined;
}
