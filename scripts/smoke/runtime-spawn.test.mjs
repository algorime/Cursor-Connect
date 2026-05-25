import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const extensionRoot = path.join(repoRoot, 'apps/extension');
const packagedBundle = path.join(extensionRoot, 'api/bundle/main.cjs');
const extensionEntry = path.join(extensionRoot, 'dist/extension.js');

async function getFreePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				reject(new Error('unable to allocate port'));
				return;
			}
			const { port } = address;
			server.close((error) => (error ? reject(error) : resolve(port)));
		});
	});
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

test('packaged extension layout contains dist entrypoint and staged api bundle', () => {
	assert.equal(fs.existsSync(extensionEntry), true, 'expected dist/extension.js in packaged layout');
	assert.equal(fs.existsSync(packagedBundle), true, 'expected api/bundle/main.cjs staged under extension');
});

test('extension-staged api bundle starts and serves health/ready/control boundaries', async () => {
	const port = await getFreePort();
	const localApiKey = 'smoke-local-api-key';
	const internalControlSecret = 'smoke-internal-control-secret';

	const child = spawn(process.execPath, [packagedBundle], {
		cwd: path.dirname(packagedBundle),
		env: {
			...process.env,
			CODEX_AUTH_EXT_PORT: String(port),
			CODEX_AUTH_EXT_HOST: '127.0.0.1',
			CODEX_AUTH_EXT_LOCAL_API_KEY: localApiKey,
			CODEX_AUTH_EXT_INTERNAL_CONTROL_SECRET: internalControlSecret
		},
		stdio: ['ignore', 'pipe', 'pipe']
	});

	try {
		const baseUrl = `http://127.0.0.1:${port}`;
		const deadline = Date.now() + 10_000;
		let healthy = false;

		while (Date.now() < deadline) {
			try {
				const response = await fetch(`${baseUrl}/health`);
				if (response.ok) {
					const body = await response.json();
					if (body.status === 'ok') {
						healthy = true;
						break;
					}
				}
			} catch {
				// retry
			}
			await sleep(100);
		}

		assert.equal(healthy, true, 'health check failed');

		const control = await fetch(`${baseUrl}/internal/control/ping`, {
			headers: { 'x-internal-control-secret': internalControlSecret }
		});
		assert.equal(control.status, 200);

		const ready = await fetch(`${baseUrl}/ready`, {
			headers: { authorization: `Bearer ${localApiKey}` }
		});
		const readyBody = await ready.json();
		assert.equal(ready.status, 200);
		assert.equal(readyBody.ready, true);
	} finally {
		child.kill('SIGTERM');
		await new Promise((resolve) => child.once('exit', resolve));
	}
});

test('extension packaging supervisor test passes', async () => {
	const { spawnSync } = await import('node:child_process');
	const result = spawnSync(
		'pnpm',
		['--filter', 'codex-auth-ext', 'exec', 'vitest', 'run', 'tests/packaging-spawn.test.ts'],
		{
			cwd: repoRoot,
			stdio: 'inherit',
			env: process.env
		}
	);

	assert.equal(result.status, 0, 'packaging supervisor vitest failed');
});
