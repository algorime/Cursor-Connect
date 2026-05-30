import { describe, expect, it } from 'vitest';

import { InMemoryExtensionStateStore } from '../src/settings/model-routing.js';
import { PublicUrlManager } from '../src/setup/public-url-manager.js';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('PublicUrlManager', () => {
	it('rejects non-HTTPS public URLs outside explicit tests', async () => {
		const manager = new PublicUrlManager({
			state: new InMemoryExtensionStateStore(),
			fetchImpl: async () => jsonResponse({ status: 'ok' }),
			getLocalApiKey: async () => 'local-key',
			getExpectedRuntimeId: () => 'runtime-1'
		});

		const result = await manager.verify('http://example.com');

		expect(result).toMatchObject({ state: 'invalid', url: 'http://example.com' });
		expect(manager.getCursorBaseUrl()).toBeNull();
	});

	it('distinguishes health-only URLs from authenticated ready URLs', async () => {
		const manager = new PublicUrlManager({
			state: new InMemoryExtensionStateStore(),
			allowHttpForTests: true,
			fetchImpl: async (input, init) => {
				const url = String(input);
				if (url.endsWith('/health')) return jsonResponse({ status: 'ok' });
				expect(init?.headers).toMatchObject({ authorization: 'Bearer local-key' });
				return jsonResponse({ ready: false, runtimeId: 'runtime-1' });
			},
			getLocalApiKey: async () => 'local-key',
			getExpectedRuntimeId: () => 'runtime-1'
		});

		const result = await manager.verify('http://127.0.0.1:8787/');

		expect(result).toMatchObject({ state: 'route_health_ok' });
		expect(manager.getCursorBaseUrl()).toBeNull();
	});

	it('returns a /v1 Cursor base URL only after matching authenticated runtime proof', async () => {
		const manager = new PublicUrlManager({
			state: new InMemoryExtensionStateStore(),
			fetchImpl: async (input) => {
				const url = String(input);
				if (url.endsWith('/health')) return jsonResponse({ status: 'ok' });
				return jsonResponse({ ready: true, runtimeId: 'runtime-1' });
			},
			getLocalApiKey: async () => 'local-key',
			getExpectedRuntimeId: () => 'runtime-1'
		});

		const result = await manager.verify('https://codex.example.com/base/');

		expect(result).toMatchObject({ state: 'authenticated_ready', runtimeId: 'runtime-1' });
		expect(manager.getCursorBaseUrl()).toBe('https://codex.example.com/base/v1');
	});

	it('does not authenticate ready when expected runtime proof is missing from /ready', async () => {
		const manager = new PublicUrlManager({
			state: new InMemoryExtensionStateStore(),
			fetchImpl: async (input) => {
				const url = String(input);
				if (url.endsWith('/health')) return jsonResponse({ status: 'ok' });
				return jsonResponse({ ready: true });
			},
			getLocalApiKey: async () => 'local-key',
			getExpectedRuntimeId: () => 'runtime-1'
		});

		const result = await manager.verify('https://codex.example.com');

		expect(result).toMatchObject({
			state: 'wrong_runtime',
			message: expect.stringMatching(/runtime proof/i)
		});
		expect(manager.getCursorBaseUrl()).toBeNull();
	});

	it('marks wrong runtime separately from wrong local API key', async () => {
		const wrongRuntime = new PublicUrlManager({
			state: new InMemoryExtensionStateStore(),
			fetchImpl: async (input) => String(input).endsWith('/health')
				? jsonResponse({ status: 'ok' })
				: jsonResponse({ ready: true, runtimeId: 'other-runtime' }),
			getLocalApiKey: async () => 'local-key',
			getExpectedRuntimeId: () => 'runtime-1'
		});
		const wrongKey = new PublicUrlManager({
			state: new InMemoryExtensionStateStore(),
			fetchImpl: async (input) => String(input).endsWith('/health')
				? jsonResponse({ status: 'ok' })
				: jsonResponse({ error: 'unauthorized' }, 403),
			getLocalApiKey: async () => 'local-key',
			getExpectedRuntimeId: () => 'runtime-1'
		});

		expect(await wrongRuntime.verify('https://codex.example.com')).toMatchObject({ state: 'wrong_runtime' });
		expect(await wrongKey.verify('https://codex.example.com')).toMatchObject({ state: 'wrong_key' });
	});

	it('verifies root health and ready when users paste a trailing /v1 Extension Base URL', async () => {
		const requested: string[] = [];
		const manager = new PublicUrlManager({
			state: new InMemoryExtensionStateStore(),
			allowHttpForTests: true,
			fetchImpl: async (input) => {
				requested.push(String(input));
				return String(input).endsWith('/health')
					? jsonResponse({ status: 'ok' })
					: jsonResponse({ ready: true, runtimeId: 'runtime-1' });
			},
			getLocalApiKey: async () => 'local-key',
			getExpectedRuntimeId: () => 'runtime-1'
		});

		const result = await manager.verify('http://127.0.0.1:8787/base/v1');

		expect(result).toMatchObject({
			state: 'authenticated_ready',
			url: 'http://127.0.0.1:8787/base'
		});
		expect(requested).toEqual([
			'http://127.0.0.1:8787/base/health',
			'http://127.0.0.1:8787/base/ready'
		]);
		expect(manager.getCursorBaseUrl()).toBe('http://127.0.0.1:8787/base/v1');
	});

	it('downgrades persisted authenticated ready state when current runtime proof changes', async () => {
		const state = new InMemoryExtensionStateStore();
		let expectedRuntime = 'runtime-1';
		const manager = new PublicUrlManager({
			state,
			fetchImpl: async (input) => String(input).endsWith('/health')
				? jsonResponse({ status: 'ok' })
				: jsonResponse({ ready: true, runtimeId: 'runtime-1' }),
			getLocalApiKey: async () => 'local-key',
			getExpectedRuntimeId: () => expectedRuntime
		});
		await manager.verify('https://codex.example.com');

		expectedRuntime = 'runtime-2';

		expect(manager.getState()).toMatchObject({
			state: 'wrong_runtime',
			runtimeId: 'runtime-1',
			message: expect.stringMatching(/different extension runtime|runtime proof/i)
		});
		expect(manager.getCursorBaseUrl()).toBeNull();
	});

});
