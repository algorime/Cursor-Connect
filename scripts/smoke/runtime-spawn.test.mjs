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
const packagedSqlWasm = path.join(extensionRoot, 'api/bundle/sql-wasm.wasm');
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
	assert.equal(fs.existsSync(packagedSqlWasm), true, 'expected sql-wasm.wasm staged under extension api bundle');
});

test('extension-staged api bundle starts and serves health/ready/control boundaries', async () => {
	const port = await getFreePort();
	const localApiKey = 'smoke-local-api-key';
	const internalControlSecret = 'smoke-internal-control-secret';
	const usageDbPath = path.join(
		await fs.promises.mkdtemp(path.join(osTmpDir(), 'codex-auth-smoke-usage-')),
		'usage.sqlite'
	);

	const child = spawn(process.execPath, [packagedBundle], {
		cwd: path.dirname(packagedBundle),
		env: {
			...process.env,
			CODEX_AUTH_EXT_PORT: String(port),
			CODEX_AUTH_EXT_HOST: '127.0.0.1',
			CODEX_AUTH_EXT_LOCAL_API_KEY: localApiKey,
			CODEX_AUTH_EXT_INTERNAL_CONTROL_SECRET: internalControlSecret,
			CODEX_AUTH_EXT_GPT54_TO_GPT55_WORKAROUND: '1',
			CODEX_AUTH_EXT_FAKE_CODEX_SCENARIO: 'success_text',
			CODEX_AUTH_EXT_USAGE_DB_PATH: usageDbPath
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

		const pollPromise = answerOneAuthRequest(baseUrl, internalControlSecret);
		const authStatus = await fetch(`${baseUrl}/internal/auth/status`, {
			method: 'POST',
			headers: {
				'x-internal-control-secret': internalControlSecret,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ codexAuthState: 'authenticated' })
		});
		assert.equal(authStatus.status, 200);

		const ready = await fetch(`${baseUrl}/ready`, {
			headers: { authorization: `Bearer ${localApiKey}` }
		});
		const readyBody = await ready.json();
		assert.equal(ready.status, 200);
		assert.equal(readyBody.ready, true);

		const models = await fetch(`${baseUrl}/v1/models`, {
			headers: { authorization: `Bearer ${localApiKey}` }
		});
		const modelsBody = await models.json();
		assert.equal(models.status, 200);
		assert.deepEqual(modelsBody.data.map((model) => model.id), ['gpt-5.4', 'gpt-5.4-mini']);

		const chat = await fetch(`${baseUrl}/v1/chat/completions`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${localApiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				model: 'gpt-5.4',
				stream: true,
				input: [{ role: 'user', content: 'synthetic smoke prompt' }]
			})
		});
		const chatBody = await chat.text();
		await pollPromise;

		assert.equal(chat.status, 200);
		assert.match(chatBody, /Hello from Codex/);
		assert.match(chatBody, /\[DONE\]/);

		const usage = await fetch(`${baseUrl}/internal/usage/records`, {
			headers: { 'x-internal-control-secret': internalControlSecret }
		});
		const usageBody = await usage.json();
		const usageSerialized = JSON.stringify(usageBody);
		assert.equal(usage.status, 200);
		assert.equal(usageBody.records.length, 1);
		assert.equal(usageBody.records[0].status, 'completed');
		assert.doesNotMatch(usageSerialized, /synthetic smoke prompt|smoke-access-token|authorization|email/i);
		assert.equal(fs.existsSync(usageDbPath), true, 'expected smoke usage sqlite database');
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

async function answerOneAuthRequest(baseUrl, internalControlSecret) {
	const poll = await fetch(`${baseUrl}/internal/auth-requests?waitMs=5000`, {
		headers: { 'x-internal-control-secret': internalControlSecret }
	});
	assert.equal(poll.status, 200);
	const pollBody = await poll.json();
	assert.ok(pollBody.request?.id, 'expected pending auth request');

	const response = await fetch(`${baseUrl}/internal/auth-requests/${pollBody.request.id}/response`, {
		method: 'POST',
		headers: {
			'x-internal-control-secret': internalControlSecret,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			ok: true,
			context: {
				accessToken: 'smoke-access-token',
				expiresAt: Date.now() + 60_000,
				localAccountKey: 'acct_smoke'
			}
		})
	});
	assert.equal(response.status, 200);
}

function osTmpDir() {
	return process.env.TMPDIR || '/tmp';
}
