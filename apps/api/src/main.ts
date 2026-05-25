import { emitSafeLog } from './logger/safe-logger.js';
import { readApiConfigFromEnv, startApiServer } from './server.js';

async function main(): Promise<void> {
	const config = readApiConfigFromEnv();

	emitSafeLog({
		component: 'api',
		eventType: 'runtime.starting',
		severity: 'info',
		timestamp: Date.now(),
		message: 'api process starting',
		port: config.port
	});

	await startApiServer(config);

	emitSafeLog({
		component: 'api',
		eventType: 'runtime.ready',
		severity: 'info',
		timestamp: Date.now(),
		message: 'api process listening',
		port: config.port
	});
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : 'api startup failed';

	emitSafeLog({
		component: 'api',
		eventType: 'runtime.launch_failed',
		severity: 'error',
		timestamp: Date.now(),
		category: 'launch',
		message
	});

	process.exit(1);
});
