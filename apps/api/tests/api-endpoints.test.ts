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

	it('accepts the generated local api key after control channel auth', async () => {
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
