import net from 'node:net';

import { LOOPBACK_HOST } from '@codex-auth-ext/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { SafeRuntimeLogger } from '../src/logger/safe-logger.js';
import { InMemoryCredentialStore } from '../src/runtime/credentials.js';
import { PortManager, type PortAvailabilityChecker } from '../src/runtime/port-manager.js';
import { MemoryPortStore } from '../src/runtime/port-store.js';
import { RuntimeSupervisor } from '../src/runtime/supervisor.js';
import {
	BrokenHealthProcessSpawner,
	FailingProcessSpawner,
	InProcessApiSpawner
} from './helpers/api-spawner.js';

class FakePortChecker implements PortAvailabilityChecker {
	constructor(private readonly unavailable: Set<number>) {}

	async isPortAvailable(_host: string, port: number): Promise<boolean> {
		return !this.unavailable.has(port);
	}
}

async function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();

		server.listen(0, LOOPBACK_HOST, () => {
			const address = server.address();

			if (!address || typeof address === 'string') {
				reject(new Error('unable to allocate port'));
				return;
			}

			const { port } = address;
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve(port);
			});
		});
	});
}

describe('RuntimeSupervisor', () => {
	const spawners: InProcessApiSpawner[] = [];

	afterEach(async () => {
		await Promise.all(spawners.map((spawner) => spawner.closeAll()));
		spawners.length = 0;
	});

	it('starts successfully through health, control, and readiness checks', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });

		const spawner = new InProcessApiSpawner();
		spawners.push(spawner);

		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner,
			getCodexAuthState: async () => 'authenticated',
			requireReadyOnStart: true
		});

		const snapshot = await supervisor.start();

		expect(snapshot.phase).toBe('ready');
		expect(snapshot.localTargetUrl).toBe(`http://${LOOPBACK_HOST}:${port}`);
	});

	it('reports port unavailable without spawning a process', async () => {
		const portStore = new MemoryPortStore();
		await portStore.write({ host: LOOPBACK_HOST, port: 55555 });

		const spawner = new InProcessApiSpawner();
		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({
				store: portStore,
				checker: new FakePortChecker(new Set([55555]))
			}),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner,
			getCodexAuthState: async () => 'authenticated',
			requireReadyOnStart: true
		});

		const snapshot = await supervisor.start();

		expect(snapshot.phase).toBe('port_unavailable');
		expect(snapshot.failureCategory).toBe('port');
	});

	it('reports health failure when the api never becomes reachable', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });

		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner: new BrokenHealthProcessSpawner(),
			healthTimeoutMs: 500,
			pollIntervalMs: 50
		});

		const snapshot = await supervisor.start();

		expect(snapshot.phase).toBe('health_failed');
		expect(snapshot.failureCategory).toBe('health');
	});

	it('reports internal control failure when control ping is rejected', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });

		const spawner = new InProcessApiSpawner();
		spawners.push(spawner);

		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner,
			internalControlTimeoutMs: 500,
			pollIntervalMs: 50,
			fetchImpl: async (input, init) => {
				const url = String(input);

				if (url.includes('/internal/control/ping')) {
					return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 403 });
				}

				return fetch(input, init);
			}
		});

		const snapshot = await supervisor.start();

		expect(snapshot.phase).toBe('internal_control_failed');
		expect(snapshot.failureCategory).toBe('internal_control');
	});

	it('reports readiness failure when /ready never becomes true', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });

		const spawner = new InProcessApiSpawner();
		spawners.push(spawner);
		const credentials = new InMemoryCredentialStore();

		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials,
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner,
			readinessTimeoutMs: 500,
			pollIntervalMs: 50,
			requireReadyOnStart: true,
			fetchImpl: async (input, init) => {
				const url = String(input);

				if (url.includes('/ready')) {
					return new Response(JSON.stringify({ ready: false }), { status: 200 });
				}

				return fetch(input, init);
			}
		});

		const snapshot = await supervisor.start();

		expect(snapshot.phase).toBe('readiness_failed');
		expect(snapshot.failureCategory).toBe('readiness');
	});

	it('reports launch failure when the api bundle is missing', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });

		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/missing-extension-path',
			devMode: false,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} })
		});

		const snapshot = await supervisor.start();

		expect(snapshot.phase).toBe('launch_failed');
		expect(snapshot.failureCategory).toBe('launch');
	});

	it('reports launch failure when spawn exits before health checks succeed', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });

		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner: new FailingProcessSpawner(),
			healthTimeoutMs: 500,
			pollIntervalMs: 50
		});

		const snapshot = await supervisor.start();

		expect(snapshot.phase).toBe('launch_failed');
		expect(snapshot.failureCategory).toBe('launch');
	});

	it('restarts deterministically without duplicate active startup', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });

		const spawner = new InProcessApiSpawner();
		spawners.push(spawner);

		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner,
			getCodexAuthState: async () => 'authenticated',
			requireReadyOnStart: true
		});

		const first = await supervisor.start();
		const secondStart = supervisor.start();
		const restarted = await supervisor.restart();
		const duplicate = await secondStart;

		expect(first.phase).toBe('ready');
		expect(restarted.phase).toBe('ready');
		expect(duplicate.phase).toBe('ready');
	});

	it('transitions to stopped on stop', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });

		const spawner = new InProcessApiSpawner();
		spawners.push(spawner);

		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner
		});

		await supervisor.start();
		const stopped = await supervisor.stop();

		expect(stopped.phase).toBe('stopped');
	});

	it('keeps the API running in repairable auth-required state on first run', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });

		const spawner = new InProcessApiSpawner();
		spawners.push(spawner);

		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner,
			getCodexAuthState: async () => 'not_configured',
			readinessTimeoutMs: 200,
			pollIntervalMs: 50
		});

		const snapshot = await supervisor.start();

		expect(snapshot.phase).toBe('running_health_only');
		expect(snapshot.message).toBe('Codex auth required');
		expect(snapshot.localTargetUrl).toBe(`http://${LOOPBACK_HOST}:${port}`);
	});

	it('passes forced refresh handoff reason through the auth poll loop', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });
		const seenReasons: string[] = [];
		const credentials = new InMemoryCredentialStore();

		const spawner = new InProcessApiSpawner();
		spawners.push(spawner);

		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials,
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner,
			getCodexAuthState: async () => 'authenticated',
			fakeCodexScenario: 'auth_401_then_success',
			authHandoffResponder: async (request) => {
				seenReasons.push(request.reason);
				return {
					ok: true,
					context: {
						accessToken: 'fixture-access-token',
						expiresAt: Date.now() + 60_000,
						localAccountKey: 'acct_fixture'
					}
				};
			},
			requireReadyOnStart: true
		});

		const snapshot = await supervisor.start();
		expect(snapshot.phase).toBe('ready');

		const response = await fetch(`${snapshot.localTargetUrl}/v1/chat/completions`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${await credentials.getLocalApiKey()}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ model: 'gpt-5.4', stream: true, input: [] })
		});

		expect(response.status).toBe(200);
		expect(seenReasons).toEqual(['normal', 'forced_refresh_after_401']);
		await supervisor.stop();
	});

	it('passes the persisted Harness Routing Workaround setting to the API process', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });
		let capturedEnv: NodeJS.ProcessEnv | null = null;

		const spawner = new InProcessApiSpawner();
		const supervisor = new RuntimeSupervisor({
			extensionPath: '/tmp/codex-auth-ext',
			devMode: true,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} }),
			spawner: {
				spawn(request) {
					capturedEnv = request.env;
					return spawner.spawn(request);
				}
			},
			getCodexAuthState: async () => 'authenticated',
			modelRoutingWorkaroundEnabled: () => true,
			requireReadyOnStart: true
		});
		spawners.push(spawner);

		const snapshot = await supervisor.start();

		expect(snapshot.phase).toBe('ready');
		expect(capturedEnv?.CODEX_AUTH_EXT_GPT54_TO_GPT55_WORKAROUND).toBe('1');
	});
});
