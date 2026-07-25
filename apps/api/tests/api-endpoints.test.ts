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
const AUTH_QUEUE_TEST_POLL_MS = 1_000;

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

	it('expires readiness when the auth handoff worker stops polling', async () => {
		let now = 1_000;
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret,
			authHandoffLeaseMs: 100,
			now: () => now
		});

		handle.readinessState.markControlAuthenticated();
		handle.readinessState.setCodexAuthState('authenticated');
		handle.readinessState.markAuthHandoffConnected();

		const ready = await handle.app.inject({
			method: 'GET',
			url: '/ready',
			headers: {
				authorization: `Bearer ${localApiKey}`
			}
		});

		now = 1_101;
		const expired = await handle.app.inject({
			method: 'GET',
			url: '/ready',
			headers: {
				authorization: `Bearer ${localApiKey}`
			}
		});
		const chat = await handle.app.inject({
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

		expect(ready.json()).toEqual({ ready: true });
		expect(expired.json()).toEqual({ ready: false });
		expect(chat.statusCode).toBe(503);
		expect(chat.json().error).toMatchObject({
			type: 'service_not_ready',
			code: 'service_not_ready'
		});
		expect(handle.readinessState.getInternalStatus()).toMatchObject({
			authHandoffConnected: false,
			proxyState: 'control_disconnected'
		});
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
	describe('runtime proof', () => {
		it('returns non-secret runtime proof only to authenticated /ready callers', async () => {
			const handle = createApiServer({
				port: 0,
				localApiKey,
				internalControlSecret,
				runtimeId: 'runtime-test-id'
			});

			handle.readinessState.markControlAuthenticated();
			handle.readinessState.markAuthHandoffConnected();
			handle.readinessState.setCodexAuthState('authenticated');

			const ready = await handle.app.inject({
				method: 'GET',
				url: '/ready',
				headers: {
					authorization: `Bearer ${localApiKey}`
				}
			});
			const rejected = await handle.app.inject({ method: 'GET', url: '/ready' });

			expect(ready.statusCode).toBe(200);
			expect(ready.json()).toEqual({ ready: true, runtimeId: 'runtime-test-id' });
			expect(JSON.stringify(ready.json())).not.toContain(localApiKey);
			expect(rejected.statusCode).toBe(401);
			expect(rejected.json()).toEqual({ error: 'unauthorized' });
		});

		it('exposes safe last authenticated Cursor traffic on internal status only', async () => {
			let now = 10_000;
			const handle = createApiServer({
				port: 0,
				localApiKey,
				internalControlSecret,
				runtimeId: 'runtime-traffic-id',
				now: () => now
			});

			await handle.app.inject({ method: 'GET', url: '/v1/models' });
			now = 10_500;
			await handle.app.inject({
				method: 'GET',
				url: '/v1/models',
				headers: {
					authorization: `Bearer ${localApiKey}`
				}
			});

			const internal = await handle.app.inject({
				method: 'GET',
				url: '/internal/status',
				headers: {
					[INTERNAL_CONTROL_HEADER]: internalControlSecret
				}
			});

			expect(internal.statusCode).toBe(200);
			expect(internal.json()).toMatchObject({
				runtimeId: 'runtime-traffic-id',
				traffic: {
					lastCursorFacingRequest: {
						method: 'GET',
						path: '/v1/models',
						at: 10_500
					}
				}
			});
			expect(JSON.stringify(internal.json())).not.toMatch(/localApiKey|internalControlSecret|test-local-api-key-value|prompt|body/i);
		});
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
	it('emits a safe cursor-facing request log without credential material', async () => {
		const lines: string[] = [];
		const originalWrite = process.stdout.write.bind(process.stdout);

		process.stdout.write = ((chunk: string | Uint8Array) => {
			lines.push(String(chunk));
			return true;
		}) as typeof process.stdout.write;

		try {
			const handle = createApiServer({
				port: 0,
				localApiKey,
				internalControlSecret,
				gpt54ToGpt55WorkaroundEnabled: true
			});

			await handle.app.inject({
				method: 'GET',
				url: '/v1/models',
				headers: {
					authorization: `Bearer ${localApiKey}`,
					'user-agent': 'cursor-smoke-test',
					'x-request-id': 'cursor-request-123'
				}
			});

			const output = lines.join('');
			const requestLogs = output
				.trim()
				.split('\n')
				.filter((line) => line.includes('"eventType":"api.request"'))
				.map((line) => JSON.parse(line));

			expect(requestLogs).toEqual([
				expect.objectContaining({
					component: 'api',
					eventType: 'api.request',
					severity: 'info',
					method: 'GET',
					path: '/v1/models',
					hasAuthHeader: true,
					userAgent: 'cursor-smoke-test',
					requestId: 'cursor-request-123'
				})
			]);
			expect(output).not.toContain(localApiKey);
		} finally {
			process.stdout.write = originalWrite;
		}
	});

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

	it('returns a conservative direct-model-first Codex-specific model list with the explicit fallback alive', async () => {
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
		expect(body.data.map((model: { id: string }) => model.id)).toEqual([
			'gpt-5.5',
			'gpt-5.6-sol',
			'gpt-5.6-terra',
			'gpt-5.6-luna',
			'gpt-5.4-mini',
			'gpt-5.4'
		]);
		expect(JSON.stringify(body)).not.toMatch(/custom|account|path|secret/i);
		expect(body.data[0]).toMatchObject({
			id: 'gpt-5.5',
			upstreamModelId: 'gpt-5.5',
			recommended: true,
			policyState: 'ready'
		});
		expect(body.data.find((model: { id: string }) => model.id === 'gpt-5.6-sol')).toMatchObject({
			upstreamModelId: 'gpt-5.6-sol',
			recommended: false,
			policyState: 'routing_not_verified',
			workaroundRequired: false
		});
		expect(body.data.find((model: { id: string }) => model.id === 'gpt-5.4')).toMatchObject({
			upstreamModelId: 'gpt-5.5',
			recommended: false,
			policyState: 'workaround_enabled',
			workaroundRequired: true
		});
	});

	it('reports the disabled workaround policy while keeping direct gpt-5.5 as the recommended model', async () => {
		const handle = createApiServer({
			port: 0,
			localApiKey,
			internalControlSecret,
			gpt54ToGpt55WorkaroundEnabled: false
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
		expect(body.data.map((model: { id: string }) => model.id)).toEqual([
			'gpt-5.5',
			'gpt-5.6-sol',
			'gpt-5.6-terra',
			'gpt-5.6-luna',
			'gpt-5.4-mini',
			'gpt-5.4'
		]);
		expect(body.data[0]).toMatchObject({
			id: 'gpt-5.5',
			upstreamModelId: 'gpt-5.5',
			recommended: true,
			policyState: 'ready'
		});
		expect(body.data.find((model: { id: string }) => model.id === 'gpt-5.4')).toMatchObject({
			upstreamModelId: 'gpt-5.4',
			recommended: false,
			policyState: 'workaround_disabled'
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

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain('"code":"insufficient_quota"');
		expect(response.body).not.toContain('Upstream response failed.');
		expect(response.body).toContain('[DONE]');
		expect(handle.usageStore.list()[0]).toMatchObject({
			status: 'failed',
			errorCategory: 'quota',
			errorCode: 'insufficient_quota',
			outputStarted: false
		});
		expect(JSON.stringify(handle.usageStore.list())).not.toMatch(/synthetic fixture request|authorization|accessToken|email/i);
	});

	it('returns safe actionable messages for extension-reached upstream failures', async () => {
		const handle = createReadyApiServer(undefined, async () => new Response('upstream unavailable', { status: 503 }));
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
		expect(response.json().error).toMatchObject({
			type: 'provider',
			code: 'upstream_http_503',
			message: expect.stringMatching(/Codex upstream|try again|run the setup doctor/i)
		});
		expect(response.body).not.toContain('upstream unavailable');
		expect(response.body).not.toContain('synthetic fixture request');
	});

	it('uses the real upstream HTTP path when no fake scenario is configured', async () => {
		const handle = createReadyApiServer(undefined, async (_input, init) => {
			expect(init?.method).toBe('POST');
			const upstreamBody = JSON.parse(String(init?.body));
			expect(upstreamBody).toMatchObject({
				model: 'gpt-5.4',
				prompt_cache_key: 'conversation-from-cursor',
				stream: true,
				store: false
			});
			expect(upstreamBody).not.toHaveProperty('metadata');
			expect(upstreamBody).not.toHaveProperty('user');
			expect(upstreamBody).not.toHaveProperty('prompt_cache_retention');
			expect(init?.headers).toMatchObject({
				accept: 'text/event-stream',
				'content-type': 'application/json',
				originator: 'codex_cli_rs',
				'User-Agent': 'codex_cli_rs/0.130.0 cursor-auth-extension/0.1',
				session_id: 'conversation-from-cursor',
				'session-id': 'conversation-from-cursor',
				thread_id: 'conversation-from-cursor',
				'thread-id': 'conversation-from-cursor',
				'x-client-request-id': 'conversation-from-cursor'
			});
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
				input: [{ role: 'user', content: 'synthetic fixture request' }],
				metadata: {
					cursorConversationId: 'conversation-from-cursor'
				},
				user: 'fixture-user-hash',
				prompt_cache_retention: '24h'
			}
		});
		await authResponder;

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain('real upstream fixture');
		expect(response.body).not.toContain('Hello from Codex');
	});

	it.each([
		{
			name: 'gpt-5.4 with workaround enabled',
			model: 'gpt-5.4',
			reasoning: { effort: 'medium', summary: 'auto' },
			gpt54ToGpt55WorkaroundEnabled: true,
			expectedUpstreamModel: 'gpt-5.5'
		},
		{
			name: 'gpt-5.4 with workaround disabled',
			model: 'gpt-5.4',
			reasoning: { effort: 'high', summary: 'auto' },
			gpt54ToGpt55WorkaroundEnabled: false,
			expectedUpstreamModel: 'gpt-5.4'
		},
		{
			name: 'gpt-5.4-mini with workaround enabled',
			model: 'gpt-5.4-mini',
			reasoning: { effort: 'low', summary: 'auto' },
			gpt54ToGpt55WorkaroundEnabled: true,
			expectedUpstreamModel: 'gpt-5.4-mini'
		}
	])('sends exact model routing and reasoning upstream for $name', async ({
		model,
		reasoning,
		gpt54ToGpt55WorkaroundEnabled,
		expectedUpstreamModel
	}) => {
		const upstreamBodies: Array<Record<string, unknown>> = [];
		const handle = createReadyApiServer(
			undefined,
			async (_input, init) => {
				upstreamBodies.push(JSON.parse(String(init?.body)));
				return upstreamSseResponse('routed upstream fixture');
			},
			{ gpt54ToGpt55WorkaroundEnabled }
		);
		const authResponder = answerNextAuthRequest(handle);

		const response = await handle.app.inject({
			method: 'POST',
			url: '/v1/chat/completions',
			headers: {
				authorization: `Bearer ${localApiKey}`
			},
			payload: {
				model,
				stream: true,
				input: [{ role: 'user', content: 'synthetic routing verification request' }],
				reasoning,
				metadata: {
					cursorConversationId: 'route-verification-conversation'
				}
			}
		});
		await authResponder;

		expect(response.statusCode).toBe(200);
		expect(upstreamBodies).toHaveLength(1);
		expect(upstreamBodies[0]).toMatchObject({
			model: expectedUpstreamModel,
			reasoning,
			stream: true,
			store: false,
			prompt_cache_key: 'route-verification-conversation'
		});
		expect(upstreamBodies[0]).not.toHaveProperty('metadata');
		expect(handle.usageStore.list()[0]).toMatchObject({
			status: 'completed',
			cursorFacingModelId: model,
			upstreamModelId: expectedUpstreamModel,
			errorCategory: 'none'
		});
	});

	it('flushes upstream SSE chunks before the upstream stream completes', async () => {
		let releaseUpstream!: () => void;
		const upstreamCanFinish = new Promise<void>((resolve) => {
			releaseUpstream = resolve;
		});
		const port = await getFreePort();
		const handle = await startApiServer({
			host: LOOPBACK_HOST,
			port,
			localApiKey,
			internalControlSecret,
			upstreamFetch: async () => new Response(
				new ReadableStream<Uint8Array>({
					async start(controller) {
						const encoder = new TextEncoder();
						controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"early chunk"}\n\n'));
						await upstreamCanFinish;
						controller.enqueue(encoder.encode('data: {"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}\n\n'));
						controller.close();
					}
				}),
				{ status: 200, headers: { 'content-type': 'text/event-stream' } }
			)
		});
		handle.readinessState.markControlAuthenticated();
		handle.readinessState.markAuthHandoffConnected();
		handle.readinessState.setCodexAuthState('authenticated');
		const authResponder = answerNextAuthRequest(handle);

		try {
			const response = await fetch(`http://${LOOPBACK_HOST}:${port}/v1/chat/completions`, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${localApiKey}`,
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					model: 'gpt-5.4',
					stream: true,
					input: [{ role: 'user', content: 'synthetic fixture request' }]
				})
			});
			await authResponder;

			expect(response.status).toBe(200);
			const reader = response.body?.getReader();
			expect(reader).toBeDefined();
			const first = await reader?.read();
			const firstText = new TextDecoder().decode(first?.value);
			expect(firstText).toContain('early chunk');
			expect(handle.usageStore.list()).toEqual([]);

			releaseUpstream();
			let rest = '';
			while (true) {
				const next = await reader?.read();
				if (!next || next.done) {
					break;
				}
				rest += new TextDecoder().decode(next.value);
			}

			expect(rest).toContain('[DONE]');
			expect(handle.usageStore.list()[0]).toMatchObject({
				status: 'completed',
				inputTokens: 1,
				outputTokens: 2,
				totalTokens: 3
			});
		} finally {
			releaseUpstream();
			await handle.app.close();
		}
	});

	it('does not carry raw upstream failure payloads into normal errors or usage records', async () => {
		const rawPayload = 'raw provider payload with prompt and token';
		const lines: string[] = [];
		const originalWrite = process.stdout.write.bind(process.stdout);
		const handle = createReadyApiServer(undefined, async () => {
			return new Response(rawPayload, { status: 429 });
		});
		const authResponder = answerNextAuthRequest(handle);

		process.stdout.write = ((chunk: string | Uint8Array) => {
			lines.push(String(chunk));
			return true;
		}) as typeof process.stdout.write;

		let response;
		try {
			response = await handle.app.inject({
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
		} finally {
			process.stdout.write = originalWrite;
		}

		const output = lines.join('');
		const responseLogs = output
			.trim()
			.split('\n')
			.filter((line) => line.includes('"eventType":"api.response"'))
			.map((line) => JSON.parse(line));
		const serialized = `${response.body}\n${JSON.stringify(handle.usageStore.list())}\n${output}`;
		expect(response.statusCode).toBe(429);
		expect(response.json().error).toMatchObject({
			type: 'rate_limit',
			code: 'upstream_http_429'
		});
		expect(responseLogs).toEqual([
			expect.objectContaining({
				component: 'api',
				eventType: 'api.response',
				severity: 'warn',
				path: '/v1/chat/completions',
				statusCode: 429,
				errorCategory: 'rate_limit',
				errorCode: 'upstream_http_429',
				upstreamStatus: 429
			})
		]);
		expect(serialized).not.toContain(rawPayload);
		expect(serialized).not.toContain('synthetic fixture request');
	});

	it.each([
		{ upstreamStatus: 400, expectedStatus: 400, category: 'invalid_request', code: 'upstream_http_400' },
		{ upstreamStatus: 402, expectedStatus: 402, category: 'quota', code: 'upstream_http_402' },
		{ upstreamStatus: 500, expectedStatus: 502, category: 'provider', code: 'upstream_http_500' }
	])('maps upstream HTTP $upstreamStatus to a safe status-faithful error', async ({ upstreamStatus, expectedStatus, category, code }) => {
		const handle = createReadyApiServer(undefined, async () => {
			return new Response('raw upstream payload must not leak', { status: upstreamStatus });
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

		expect(response.statusCode).toBe(expectedStatus);
		expect(response.json().error).toMatchObject({
			type: category,
			code
		});
		expect(response.body).not.toContain('raw upstream payload must not leak');
		expect(handle.usageStore.list()[0]).toMatchObject({
			status: 'failed',
			errorCategory: category,
			errorCode: code,
			outputStarted: false
		});
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
	upstreamFetch?: typeof fetch,
	overrides: Partial<Parameters<typeof createApiServer>[0]> = {}
): ReturnType<typeof createApiServer> {
	const handle = createApiServer({
		port: 0,
		localApiKey,
		internalControlSecret,
		fakeCodexScenario,
		upstreamFetch,
		...overrides
	});
	handle.readinessState.markControlAuthenticated();
	handle.readinessState.markAuthHandoffConnected();
	handle.readinessState.setCodexAuthState('authenticated');

	return handle;
}

function upstreamSseResponse(text: string): Response {
	return new Response(
		[
			`data: {"type":"response.output_text.delta","delta":${JSON.stringify(text)}}`,
			'',
			'data: {"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}',
			'',
			''
		].join('\n'),
		{ status: 200 }
	);
}

async function answerNextAuthRequest(handle: ReturnType<typeof createApiServer>): Promise<void> {
	const polled = await handle.authQueue.poll(AUTH_QUEUE_TEST_POLL_MS);
	expect(polled).not.toBeNull();
	handle.authQueue.respond(polled?.id ?? '', {
		ok: true,
		context: {
			accessToken: 'fixture-access-token',
			expiresAt: Date.now() + 60_000,
			localAccountKey: 'acct_local_fixture',
			upstreamHeaders: {
				'ChatGPT-Account-Id': 'acct_fixture',
				originator: 'codex_cli_rs'
			}
		}
	});
}

async function answerAuthRequests(
	handle: ReturnType<typeof createApiServer>,
	count: number
): Promise<string[]> {
	const reasons: string[] = [];

	for (let index = 0; index < count; index += 1) {
		const polled = await handle.authQueue.poll(AUTH_QUEUE_TEST_POLL_MS);
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
