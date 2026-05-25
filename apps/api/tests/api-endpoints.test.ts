import {
	generateSecret,
	HEALTH_RESPONSE,
	INTERNAL_CONTROL_HEADER,
	LOOPBACK_HOST
} from '@codex-auth-ext/shared';
import { describe, expect, it } from 'vitest';

import { createApiServer, startApiServer } from '../src/server.js';

const localApiKey = 'test-local-api-key-value';
const internalControlSecret = 'test-internal-control-secret-value';

describe('/health', () => {
	it('returns minimal unauthenticated liveness', async () => {
		const port = await getFreePort();
		const handle = await startApiServer({
			host: LOOPBACK_HOST,
			port,
			localApiKey,
			internalControlSecret
		});

		try {
			const response = await fetch(`http://${LOOPBACK_HOST}:${port}/health`);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toEqual(HEALTH_RESPONSE);
			expect(Object.keys(body as object)).toEqual(['status']);
		} finally {
			await handle.app.close();
		}
	});
});

describe('/ready', () => {
	it('rejects missing auth', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret
		});

		const response = await handle.app.inject({ method: 'GET', url: '/ready' });

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({ error: 'unauthorized' });
	});

	it('rejects incorrect auth', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret
		});

		const response = await handle.app.inject({
			method: 'GET',
			url: '/ready',
			headers: {
				authorization: 'Bearer wrong-key'
			}
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({ error: 'unauthorized' });
	});

	it('keeps readiness false after control auth until Codex auth handoff is usable', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret
		});

		await handle.app.inject({
			method: 'GET',
			url: '/internal/control/ping',
			headers: {
				[INTERNAL_CONTROL_HEADER]: internalControlSecret
			}
		});

		const response = await handle.app.inject({
			method: 'GET',
			url: '/ready',
			headers: {
				authorization: `Bearer ${localApiKey}`
			}
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ ready: false });
	});

	it('accepts the generated local api key after control, handoff, and Codex auth are ready', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret,
			gpt54ToGpt55WorkaroundEnabled: true
		});

		handle.readinessState.markControlAuthenticated();
		handle.readinessState.markAuthHandoffConnected();
		handle.readinessState.setCodexAuthState('authenticated');

		const response = await handle.app.inject({
			method: 'GET',
			url: '/ready',
			headers: {
				authorization: `Bearer ${localApiKey}`
			}
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ ready: true });
	});

	it('returns ready false before internal control authentication', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret
		});

		const response = await handle.app.inject({
			method: 'GET',
			url: '/ready',
			headers: {
				authorization: `Bearer ${localApiKey}`
			}
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ ready: false });
	});

	it('does not expose diagnostic details on auth failure', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret
		});

		const response = await handle.app.inject({
			method: 'GET',
			url: '/ready',
			headers: {
				authorization: 'Bearer nope'
			}
		});

		const body = JSON.stringify(response.json());

		expect(body).not.toMatch(/model|account|tunnel|quota|path|setup/i);
	});
});

describe('internal control boundary', () => {
	it('requires the internal control secret', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret
		});

		const response = await handle.app.inject({
			method: 'GET',
			url: '/internal/control/ping'
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({ error: 'unauthorized' });
	});

	it('accepts the internal control secret', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret
		});

		const response = await handle.app.inject({
			method: 'GET',
			url: '/internal/control/ping',
			headers: {
				[INTERNAL_CONTROL_HEADER]: internalControlSecret
			}
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ ok: true });
	});
});

describe('credential separation', () => {
	it('rejects the local api key on internal control endpoints', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret
		});

		const response = await handle.app.inject({
			method: 'GET',
			url: '/internal/control/ping',
			headers: {
				authorization: `Bearer ${localApiKey}`
			}
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({ error: 'unauthorized' });
	});

	it('rejects the internal control secret on /ready', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret
		});

		const response = await handle.app.inject({
			method: 'GET',
			url: '/ready',
			headers: {
				[INTERNAL_CONTROL_HEADER]: internalControlSecret
			}
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({ error: 'unauthorized' });
	});
});

describe('/v1/models', () => {
	it('requires the generated local api key and rejects internal control secret', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret
		});

		const missing = await handle.app.inject({ method: 'GET', url: '/v1/models' });
		const internal = await handle.app.inject({
			method: 'GET',
			url: '/v1/models',
			headers: {
				[INTERNAL_CONTROL_HEADER]: internalControlSecret
			}
		});

		expect(missing.statusCode).toBe(401);
		expect(internal.statusCode).toBe(403);
	});

	it('returns a conservative Codex-specific model list', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret,
			gpt54ToGpt55WorkaroundEnabled: true
		});

		const response = await handle.app.inject({
			method: 'GET',
			url: '/v1/models',
			headers: {
				authorization: `Bearer ${localApiKey}`
			}
		});

		const body = response.json();

		expect(response.statusCode).toBe(200);
		expect(body.data.map((model: { id: string }) => model.id)).toEqual(['gpt-5.4', 'gpt-5.4-mini']);
		expect(JSON.stringify(body)).not.toMatch(/custom|account|path|secret/i);
		expect(body.data[0]).toMatchObject({
			id: 'gpt-5.4',
			upstreamModelId: 'gpt-5.5',
			policyState: 'workaround_enabled'
		});
	});
});

describe('/v1/chat/completions', () => {
	it('requires the generated local api key and rejects the internal control secret', async () => {
		const handle = createReadyApiServer();

		const missing = await handle.app.inject({ method: 'POST', url: '/v1/chat/completions' });
		const internal = await handle.app.inject({
			method: 'POST',
			url: '/v1/chat/completions',
			headers: {
				[INTERNAL_CONTROL_HEADER]: internalControlSecret
			}
		});

		expect(missing.statusCode).toBe(401);
		expect(internal.statusCode).toBe(403);
	});

	it('streams fixture-backed Chat Completions SSE and records safe usage', async () => {
		const handle = createReadyApiServer('success_text');
		const authResponder = answerNextAuthRequest(handle);

		const response = await handle.app.inject({
			method: 'POST',
			url: '/v1/chat/completions',
			headers: {
				authorization: `Bearer ${localApiKey}`
			},
			payload: {
				model: 'gpt-5.4',
				stream: true,
				input: [{ role: 'user', content: 'synthetic fixture request' }]
			}
		});
		await authResponder;

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain('data:');
		expect(response.body).toContain('[DONE]');
		expect(response.body).toContain('Hello from Codex.');
		expect(JSON.stringify(handle.usageStore.list())).not.toMatch(/synthetic fixture request|authorization|accessToken|email/i);
		expect(handle.usageStore.list()[0]).toMatchObject({
			status: 'completed',
			cursorFacingModelId: 'gpt-5.4',
			upstreamModelId: 'gpt-5.4',
			errorCategory: 'none'
		});
	});

	it('uses forced same-account refresh once for a pre-output upstream 401 scenario', async () => {
		const handle = createReadyApiServer('auth_401_then_success');
		const authResponder = answerAuthRequests(handle, 2);

		const response = await handle.app.inject({
			method: 'POST',
			url: '/v1/chat/completions',
			headers: {
				authorization: `Bearer ${localApiKey}`
			},
			payload: {
				model: 'gpt-5.4',
				stream: true,
				input: [{ role: 'user', content: 'synthetic fixture request' }]
			}
		});
		const reasons = await authResponder;

		expect(response.statusCode).toBe(200);
		expect(reasons).toEqual(['normal', 'forced_refresh_after_401']);
		expect(handle.usageStore.list()[0]).toMatchObject({
			status: 'completed',
			errorCategory: 'none'
		});
	});

	it('records safe failed usage for hard quota-like fixture failures', async () => {
		const handle = createReadyApiServer('hard_quota');
		const authResponder = answerNextAuthRequest(handle);

		const response = await handle.app.inject({
			method: 'POST',
			url: '/v1/chat/completions',
			headers: {
				authorization: `Bearer ${localApiKey}`
			},
			payload: {
				model: 'gpt-5.4',
				stream: true,
				input: [{ role: 'user', content: 'synthetic fixture request' }]
			}
		});
		await authResponder;

		expect(response.statusCode).toBe(502);
		expect(handle.usageStore.list()[0]).toMatchObject({
			status: 'failed',
			errorCategory: 'quota',
			errorCode: 'insufficient_quota',
			outputStarted: false
		});
		expect(JSON.stringify(handle.usageStore.list())).not.toMatch(/synthetic fixture request|authorization|accessToken|email/i);
	});

	it('uses the real upstream HTTP path when no fake scenario is configured', async () => {
		const handle = createReadyApiServer(undefined, async (_input, init) => {
			expect(init?.method).toBe('POST');
			expect(JSON.stringify(init?.body)).toContain('gpt-5.4');
			return new Response(
				[
					'data: {"type":"response.output_text.delta","delta":"real upstream fixture"}',
					'',
					'data: {"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}',
					'',
					''
				].join('\n'),
				{ status: 200 }
			);
		});
		const authResponder = answerNextAuthRequest(handle);

		const response = await handle.app.inject({
			method: 'POST',
			url: '/v1/chat/completions',
			headers: {
				authorization: `Bearer ${localApiKey}`
			},
			payload: {
				model: 'gpt-5.4',
				stream: true,
				input: [{ role: 'user', content: 'synthetic fixture request' }]
			}
		});
		await authResponder;

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain('real upstream fixture');
		expect(response.body).not.toContain('Hello from Codex');
	});

	it('does not carry raw upstream failure payloads into normal errors or usage records', async () => {
		const rawPayload = 'raw provider payload with prompt and token';
		const handle = createReadyApiServer(undefined, async () => {
			return new Response(rawPayload, { status: 500 });
		});
		const authResponder = answerNextAuthRequest(handle);

		const response = await handle.app.inject({
			method: 'POST',
			url: '/v1/chat/completions',
			headers: {
				authorization: `Bearer ${localApiKey}`
			},
			payload: {
				model: 'gpt-5.4',
				stream: true,
				input: [{ role: 'user', content: 'synthetic fixture request' }]
			}
		});
		await authResponder;

		const serialized = `${response.body}\n${JSON.stringify(handle.usageStore.list())}`;
		expect(response.statusCode).toBe(502);
		expect(serialized).not.toContain(rawPayload);
		expect(serialized).not.toContain('synthetic fixture request');
	});
});

describe('safe auth failure logging', () => {
	it('does not log submitted credential values', async () => {
		const lines: string[] = [];
		const originalWrite = process.stdout.write.bind(process.stdout);

		process.stdout.write = ((chunk: string | Uint8Array) => {
			lines.push(String(chunk));
			return true;
		}) as typeof process.stdout.write;

		try {
			const handle = createApiServer({
				port: 0,
				localApiKey: generateSecret(),
				internalControlSecret: generateSecret()
			});

			const leakedKey = 'leaked-local-api-key-material';

			await handle.app.inject({
				method: 'GET',
				url: '/ready',
				headers: {
					authorization: `Bearer ${leakedKey}`
				}
			});

			const output = lines.join('');

			expect(output).not.toContain(leakedKey);
		} finally {
			process.stdout.write = originalWrite;
		}
	});
});

async function getFreePort(): Promise<number> {
	const net = await import('node:net');

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

type FakeScenario = NonNullable<Parameters<typeof createApiServer>[0]['fakeCodexScenario']>;

function createReadyApiServer(
	fakeCodexScenario?: FakeScenario,
	upstreamFetch?: typeof fetch
): ReturnType<typeof createApiServer> {
	const handle = createApiServer({
		port: 0,
		localApiKey,
		internalControlSecret,
		fakeCodexScenario,
		upstreamFetch
	});
	handle.readinessState.markControlAuthenticated();
	handle.readinessState.markAuthHandoffConnected();
	handle.readinessState.setCodexAuthState('authenticated');

	return handle;
}

async function answerNextAuthRequest(handle: ReturnType<typeof createApiServer>): Promise<void> {
	const polled = await handle.authQueue.poll(50);
	expect(polled).not.toBeNull();
	handle.authQueue.respond(polled?.id ?? '', {
		ok: true,
		context: {
			accessToken: 'fixture-access-token',
			expiresAt: Date.now() + 60_000,
			localAccountKey: 'acct_local_fixture'
		}
	});
}

async function answerAuthRequests(
	handle: ReturnType<typeof createApiServer>,
	count: number
): Promise<string[]> {
	const reasons: string[] = [];

	for (let index = 0; index < count; index += 1) {
		const polled = await handle.authQueue.poll(50);
		expect(polled).not.toBeNull();
		reasons.push(polled?.reason ?? '');
		handle.authQueue.respond(polled?.id ?? '', {
			ok: true,
			context: {
				accessToken: `fixture-access-token-${index}`,
				expiresAt: Date.now() + 60_000,
				localAccountKey: 'acct_local_fixture'
			}
		});
	}

	return reasons;
}
