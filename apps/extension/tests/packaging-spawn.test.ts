import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOOPBACK_HOST } from '@codex-auth-ext/shared';
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { SafeRuntimeLogger } from '../src/logger/safe-logger.js';
import { InMemoryCredentialStore } from '../src/runtime/credentials.js';
import { PortManager, type PortAvailabilityChecker } from '../src/runtime/port-manager.js';
import { MemoryPortStore } from '../src/runtime/port-store.js';
import { resolveApiBundlePaths } from '../src/runtime/process-spawner.js';
import { RuntimeSupervisor } from '../src/runtime/supervisor.js';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

describe('packaged extension layout', () => {
	const supervisors: RuntimeSupervisor[] = [];

	afterEach(async () => {
		await Promise.all(supervisors.map((supervisor) => supervisor.stop()));
		supervisors.length = 0;
	});

	it('stages the api bundle inside the extension install tree', () => {
		const packagedEntry = path.join(extensionRoot, 'api/bundle/main.cjs');
		const dashboardManifest = path.join(extensionRoot, 'dashboard/.vite/manifest.json');

		expect(fs.existsSync(packagedEntry)).toBe(true);
		expect(fs.existsSync(path.join(extensionRoot, 'dist/extension.js'))).toBe(true);
		expect(fs.existsSync(dashboardManifest)).toBe(true);
	});

	it('resolves the packaged api bundle from the extension path', () => {
		const paths = resolveApiBundlePaths(extensionRoot, false);

		expect(paths.apiEntryPath).toBe(path.join(extensionRoot, 'api/bundle/main.cjs'));
		expect(paths.cwd).toBe(path.join(extensionRoot, 'api/bundle'));
		expect(fs.existsSync(paths.apiEntryPath)).toBe(true);
	});

	it('starts the runtime from the packaged extension layout', async () => {
		const portStore = new MemoryPortStore();
		const port = await getFreePort();
		await portStore.write({ host: LOOPBACK_HOST, port });

		const supervisor = new RuntimeSupervisor({
			extensionPath: extensionRoot,
			devMode: false,
			portManager: new PortManager({ store: portStore, checker: new FakePortChecker(new Set()) }),
			credentials: new InMemoryCredentialStore(),
			logger: new SafeRuntimeLogger({ write: () => {} }),
			getCodexAuthState: async () => 'authenticated',
			requireReadyOnStart: true
		});
		supervisors.push(supervisor);

		const snapshot = await supervisor.start();

		expect(snapshot.phase).toBe('ready');
		expect(snapshot.localTargetUrl).toBe(`http://${LOOPBACK_HOST}:${port}`);
	});
});
