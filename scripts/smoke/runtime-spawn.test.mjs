import fs from 'node:fs';
import http from 'node:http';
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
const packagedDashboardManifest = path.join(extensionRoot, 'dashboard/.vite/manifest.json');
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
	assert.equal(fs.existsSync(packagedDashboardManifest), true, 'expected Svelte dashboard manifest staged under extension');
});

test('extension-staged api bundle starts and verifies packaged model routing', async () => {
	await runPackagedApiProbe({
		workaroundEnabled: true,
		cursorModel: 'gpt-5.4',
		expectedUpstreamModel: 'gpt-5.5',
		reasoning: { effort: 'medium', summary: 'auto' }
	});
	await runPackagedApiProbe({
		workaroundEnabled: false,
		cursorModel: 'gpt-5.4',
		expectedUpstreamModel: 'gpt-5.4',
		reasoning: { effort: 'high', summary: 'auto' }
	});
	await runPackagedApiProbe({
		workaroundEnabled: false,
		cursorModel: 'gpt-5.5',
		expectedUpstreamModel: 'gpt-5.5',
		reasoning: { effort: 'low', summary: 'auto' }
	});
});

async function runPackagedApiProbe({ workaroundEnabled, cursorModel, expectedUpstreamModel, reasoning }) {
	const port = await getFreePort();
	const localApiKey = 'smoke-local-api-key';
	const internalControlSecret = 'smoke-internal-control-secret';
	const upstream = await startUpstreamCaptureServer();
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
			CODEX_AUTH_EXT_GPT54_TO_GPT55_WORKAROUND: workaroundEnabled ? '1' : '0',
			CODEX_AUTH_EXT_CODEX_RESPONSES_URL: upstream.url,
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
		assert.deepEqual(modelsBody.data.map((model) => model.id), ['gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4']);

		const chat = await fetch(`${baseUrl}/v1/chat/completions`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${localApiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				model: cursorModel,
				stream: true,
				input: [{ role: 'user', content: 'synthetic smoke prompt' }],
				reasoning,
				metadata: {
					cursorConversationId: `smoke-routing-${cursorModel}-${workaroundEnabled ? 'enabled' : 'disabled'}`
				}
			})
		});
		const chatBody = await chat.text();
		await pollPromise;

		assert.equal(chat.status, 200);
		assert.match(chatBody, /packaged upstream fixture/);
		assert.match(chatBody, /\[DONE\]/);
		assert.equal(upstream.requests.length, 1, 'expected one upstream Codex Responses POST');
		assert.equal(upstream.requests[0].method, 'POST');
		assert.equal(upstream.requests[0].body.model, expectedUpstreamModel);
		assert.deepEqual(upstream.requests[0].body.reasoning, reasoning);
		assert.equal(upstream.requests[0].body.prompt_cache_key, `smoke-routing-${cursorModel}-${workaroundEnabled ? 'enabled' : 'disabled'}`);
		assert.equal(Object.hasOwn(upstream.requests[0].body, 'metadata'), false);

		const usage = await fetch(`${baseUrl}/internal/usage/records`, {
			headers: { 'x-internal-control-secret': internalControlSecret }
		});
		const usageBody = await usage.json();
		const usageSerialized = JSON.stringify(usageBody);
		assert.equal(usage.status, 200);
		assert.equal(usageBody.records.length, 1);
		assert.equal(usageBody.records[0].status, 'completed');
		assert.equal(usageBody.records[0].cursorFacingModelId, cursorModel);
		assert.equal(usageBody.records[0].upstreamModelId, expectedUpstreamModel);
		assert.doesNotMatch(usageSerialized, /synthetic smoke prompt|smoke-access-token|authorization|email/i);
		assert.equal(fs.existsSync(usageDbPath), true, 'expected smoke usage sqlite database');
	} finally {
		child.kill('SIGTERM');
		await new Promise((resolve) => child.once('exit', resolve));
		await upstream.close();
	}
}

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

async function startUpstreamCaptureServer() {
	const requests = [];
	const server = http.createServer(async (request, response) => {
		const bodyText = await readRequestBody(request);
		requests.push({
			method: request.method,
			url: request.url,
			headers: request.headers,
			body: bodyText ? JSON.parse(bodyText) : null
		});
		response.writeHead(200, {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache'
		});
		response.end([
			'data: {"type":"response.output_text.delta","delta":"packaged upstream fixture"}',
			'',
			'data: {"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}',
			'',
			''
		].join('\n'));
	});
	const port = await getFreePort();
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, '127.0.0.1', () => {
			server.off('error', reject);
			resolve();
		});
	});

	return {
		url: `http://127.0.0.1:${port}/backend-api/codex/responses`,
		requests,
		close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
	};
}

async function readRequestBody(request) {
	let body = '';
	for await (const chunk of request) {
		body += String(chunk);
	}
	return body;
}

function osTmpDir() {
	return process.env.TMPDIR || '/tmp';
}
