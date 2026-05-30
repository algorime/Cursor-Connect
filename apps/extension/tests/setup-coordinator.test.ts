import {
	createEmptyApiTrafficStatus,
	createQuickTunnelStatus,
	type RuntimeSnapshot
} from '@codex-auth-ext/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InMemoryCredentialStore } from '../src/runtime/credentials.js';
import { InMemoryExtensionStateStore } from '../src/settings/model-routing.js';
import { PublicUrlManager } from '../src/setup/public-url-manager.js';
import { OpenAiKeyRepairController } from '../src/setup/openai-key-repair.js';
import type { QuickTunnelManager } from '../src/setup/quick-tunnel-manager.js';
import { SetupCoordinator } from '../src/setup/setup-coordinator.js';

const readyRuntime: RuntimeSnapshot = {
	phase: 'ready',
	failureCategory: 'none',
	localTargetUrl: 'http://127.0.0.1:49152',
	port: 49152,
	message: null,
	runtimeId: 'runtime-1',
	updatedAt: 1
};

describe('SetupCoordinator', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('feeds setup, doctor, status, and Cursor setup from real setup owners', async () => {
		const state = new InMemoryExtensionStateStore();
		const credentials = new InMemoryCredentialStore({ localApiKey: 'local-key' });
		const publicUrl = new PublicUrlManager({
			state,
			fetchImpl: async (input) => String(input).endsWith('/health')
				? jsonResponse({ status: 'ok' })
				: jsonResponse({ ready: true, runtimeId: 'runtime-1' }),
			getLocalApiKey: () => credentials.getLocalApiKey(),
			getExpectedRuntimeId: () => readyRuntime.runtimeId
		});
		await publicUrl.verify('https://codex.example.com');
		let restarts = 0;
		let workaroundDecision: 'enabled' | 'skipped' | 'decide_later' = 'enabled';
		const coordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => ({
				runtimeId: 'runtime-1',
				traffic: { lastCursorFacingRequest: { method: 'GET', path: '/v1/models', at: 2 } },
				controlConfigured: true,
				controlAuthenticated: true,
				authHandoffConnected: true,
				codexAuthState: 'authenticated',
				modelPolicyState: 'workaround_enabled',
				proxyState: 'proxy_ready',
				usageStorageState: 'ready'
			}),
			getModelWorkaroundEnabled: () => workaroundDecision === 'enabled',
			getModelWorkaroundDecision: () => workaroundDecision,
			setModelWorkaroundDecision: async (decision) => { workaroundDecision = decision; },
			restartRuntime: async () => {
				restarts += 1;
				return readyRuntime;
			},
			getTunnelStatus: () => createQuickTunnelStatus('running', 'https://abc.trycloudflare.com'),
			openAiKeyRepair: new OpenAiKeyRepairController({
				state,
				detectCapability: async () => ({ available: true })
			})
		});

		const setup = await coordinator.getSetupState();
		const doctor = await coordinator.runDoctor();
		const cursorSetup = await coordinator.buildCursorSetupText();
		const status = await coordinator.getStatusBarViewModel();

		expect(setup.publicUrl).toMatchObject({ state: 'authenticated_ready' });
		expect(setup.environmentLabel).toBe('Current extension host');
		expect(setup.apiTraffic.lastCursorFacingRequest?.path).toBe('/v1/models');
		expect(cursorSetup).toContain('"baseUrl": "https://codex.example.com/v1"');
		expect(cursorSetup).not.toContain('internalControlSecret');
		expect(await coordinator.copyCursorSetupValue('base_url')).toBe('https://codex.example.com/v1');
		expect(await coordinator.copyCursorSetupValue('api_key')).toBe('local-key');
		expect(await coordinator.copyCursorSetupValue('full')).toContain('"baseUrl": "https://codex.example.com/v1"');
		expect(await coordinator.copyCursorSetupValue('models')).not.toContain('local-key');
		expect(doctor.checks.map((check) => check.id)).toContain('public-url-health');
		expect(doctor.checks.map((check) => check.id)).toContain('public-url-ready');
		expect(doctor.checks.map((check) => check.id)).toContain('environment');
		expect(doctor.groups.pass.length).toBeGreaterThan(0);
		expect((await coordinator.setOpenAiKeyRepairDecision('enabled')).checks.find((check) => check.id === 'openai-key-repair')?.details).toMatchObject({
			decision: 'enabled',
			capability: 'available'
		});
		expect(await coordinator.getSetupState()).toMatchObject({
			openAiKeyRepair: {
				decision: 'enabled',
				capability: 'available'
			}
		});
		expect(await coordinator.setStatusBarPreference('hidden')).toMatchObject({ statusBarPreference: 'hidden' });
		expect(await coordinator.setNotificationPreference('important_only')).toMatchObject({ notificationPreference: 'important_only' });
		expect(await coordinator.setNotificationPreference('verbose')).toMatchObject({ notificationPreference: 'verbose' });
		expect(await coordinator.setModelWorkaroundDecision('skipped')).toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ id: 'harness-workaround', status: 'complete' })]) });
		expect(restarts).toBe(1);
		expect(await coordinator.copyCursorSetupValue('models')).toContain('skipped');
		expect(status).toMatchObject({ text: 'Codex: Tunnel' });
	});

	it('lets explicit readiness override tunnel-running status as Ready with a temporary warning', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000);
		const state = new InMemoryExtensionStateStore();
		const credentials = new InMemoryCredentialStore({ localApiKey: 'local-key' });
		const publicUrl = new PublicUrlManager({
			state,
			fetchImpl: async (input) => String(input).endsWith('/health')
				? jsonResponse({ status: 'ok' })
				: jsonResponse({ ready: true, runtimeId: 'runtime-1' }),
			getLocalApiKey: () => credentials.getLocalApiKey(),
			getExpectedRuntimeId: () => readyRuntime.runtimeId
		});
		await publicUrl.verify('https://quick.trycloudflare.com', { source: 'quick_tunnel' });
		const coordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => ({
				runtimeId: 'runtime-1',
				traffic: { lastCursorFacingRequest: { method: 'GET', path: '/v1/models', at: 1_500 } },
				controlConfigured: true,
				controlAuthenticated: true,
				authHandoffConnected: true,
				codexAuthState: 'authenticated',
				modelPolicyState: 'workaround_enabled',
				proxyState: 'proxy_ready',
				usageStorageState: 'ready'
			}),
			getModelWorkaroundEnabled: () => true,
			getModelWorkaroundDecision: () => 'enabled',
			getTunnelStatus: () => createQuickTunnelStatus('running', 'https://quick.trycloudflare.com')
		});
		await coordinator.markManualConfirmation(true);

		await expect(coordinator.getSetupState()).resolves.toMatchObject({
			readiness: { state: 'ready', warnings: expect.arrayContaining(['Temporary Extension Base URL']) }
		});
		await expect(coordinator.getStatusBarViewModel()).resolves.toMatchObject({
			text: 'Codex: Ready',
			tooltip: expect.stringMatching(/temporary Quick Tunnel/i)
		});
	});

	it('does not copy or show Ready for a Quick Tunnel URL after the tunnel exits', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000);
		const state = new InMemoryExtensionStateStore();
		const credentials = new InMemoryCredentialStore({ localApiKey: 'local-key' });
		const publicUrl = new PublicUrlManager({
			state,
			fetchImpl: async (input) => String(input).endsWith('/health')
				? jsonResponse({ status: 'ok' })
				: jsonResponse({ ready: true, runtimeId: 'runtime-1' }),
			getLocalApiKey: () => credentials.getLocalApiKey(),
			getExpectedRuntimeId: () => readyRuntime.runtimeId
		});
		await publicUrl.verify('https://dead.trycloudflare.com', { source: 'quick_tunnel' });
		const coordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => ({
				runtimeId: 'runtime-1',
				traffic: { lastCursorFacingRequest: { method: 'GET', path: '/v1/models', at: 1_500 } },
				controlConfigured: true,
				controlAuthenticated: true,
				authHandoffConnected: true,
				codexAuthState: 'authenticated',
				modelPolicyState: 'workaround_enabled',
				proxyState: 'proxy_ready',
				usageStorageState: 'ready'
			}),
			getModelWorkaroundEnabled: () => true,
			getModelWorkaroundDecision: () => 'enabled',
			getTunnelStatus: () => createQuickTunnelStatus('exited', null, 'process exited')
		});
		await coordinator.markManualConfirmation(true);

		await expect(coordinator.getSetupState()).resolves.toMatchObject({
			publicUrl: { state: 'route_health_ok', source: 'quick_tunnel' },
			readiness: { state: 'setup', blockers: expect.arrayContaining(['Public Extension Base URL']) }
		});
		expect(coordinator.getCursorBaseUrl()).toBeNull();
		await expect(coordinator.copyCursorSetupValue('base_url')).rejects.toThrow(/verify/i);
		await expect(coordinator.getStatusBarViewModel()).resolves.toMatchObject({ text: 'Codex: Route' });
	});

	it('does not copy an unverified public URL as a Cursor base URL', async () => {
		const state = new InMemoryExtensionStateStore();
		const credentials = new InMemoryCredentialStore({ localApiKey: 'local-key' });
		const publicUrl = new PublicUrlManager({
			state,
			fetchImpl: async (input) => String(input).endsWith('/health')
				? jsonResponse({ status: 'ok' })
				: new Response(JSON.stringify({ ready: false }), { status: 503 }),
			getLocalApiKey: () => credentials.getLocalApiKey(),
			getExpectedRuntimeId: () => readyRuntime.runtimeId
		});
		await publicUrl.verify('https://codex.example.com');
		const coordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => null,
			getModelWorkaroundEnabled: () => false,
			restartRuntime: async () => readyRuntime
		});

		await expect(coordinator.copyCursorSetupValue('base_url')).rejects.toThrow(/verify/i);
		await expect(coordinator.copyCursorSetupValue('models')).resolves.toContain('gpt-5.5');
		await expect(coordinator.copyCursorSetupValue('full')).rejects.toThrow(/public Extension Base URL/i);
		await expect(coordinator.buildCursorSetupText()).rejects.toThrow(/public Extension Base URL/i);
	});

	it('restarts the API runtime when rotating the local API key', async () => {
		const state = new InMemoryExtensionStateStore();
		const credentials = new InMemoryCredentialStore({ localApiKey: 'old-key' });
		const publicUrl = new PublicUrlManager({
			state,
			fetchImpl: async () => jsonResponse({ status: 'ok', ready: true, runtimeId: 'runtime-1' }),
			getLocalApiKey: () => credentials.getLocalApiKey(),
			getExpectedRuntimeId: () => readyRuntime.runtimeId
		});
		let restarts = 0;
		const coordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => null,
			getModelWorkaroundEnabled: () => false,
			restartRuntime: async () => {
				restarts += 1;
				return readyRuntime;
			}
		});

		const rotationMessage = await coordinator.rotateLocalApiKey();

		expect(restarts).toBe(1);
		expect(rotationMessage).not.toContain('old-key');
		expect(rotationMessage).not.toContain(await credentials.getLocalApiKey());
		expect(rotationMessage).toMatch(/Copy local API key/i);
		expect(publicUrl.getState()).toMatchObject({ state: 'not_configured' });
	});

	it('auto-verifies a running Quick Tunnel as the temporary Extension Base URL', async () => {
		const state = new InMemoryExtensionStateStore();
		const credentials = new InMemoryCredentialStore({ localApiKey: 'local-key' });
		const publicUrl = new PublicUrlManager({
			state,
			fetchImpl: async (input) => String(input).endsWith('/health')
				? jsonResponse({ status: 'ok' })
				: jsonResponse({ ready: true, runtimeId: 'runtime-1' }),
			getLocalApiKey: () => credentials.getLocalApiKey(),
			getExpectedRuntimeId: () => readyRuntime.runtimeId
		});
		const coordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => null,
			getModelWorkaroundEnabled: () => false,
			quickTunnel: quickTunnelDouble({
				state: 'running',
				url: 'https://quick.trycloudflare.com'
			})
		});

		await expect(coordinator.startQuickTunnel()).resolves.toMatchObject({ state: 'running', url: 'https://quick.trycloudflare.com' });

		expect(publicUrl.getState()).toMatchObject({
			state: 'authenticated_ready',
			url: 'https://quick.trycloudflare.com',
			source: 'quick_tunnel',
			temporary: true
		});
		expect(coordinator.getCursorBaseUrl()).toBe('https://quick.trycloudflare.com/v1');
	});

	it('retries Quick Tunnel public URL verification while the Cloudflare route warms up', async () => {
		let healthAttempts = 0;
		const state = new InMemoryExtensionStateStore();
		const credentials = new InMemoryCredentialStore({ localApiKey: 'local-key' });
		const publicUrl = new PublicUrlManager({
			state,
			fetchImpl: async (input) => {
				const url = String(input);
				if (url.endsWith('/health')) {
					healthAttempts += 1;
					return healthAttempts < 3
						? new Response('warming up', { status: 502 })
						: jsonResponse({ status: 'ok' });
				}
				return jsonResponse({ ready: true, runtimeId: 'runtime-1' });
			},
			getLocalApiKey: () => credentials.getLocalApiKey(),
			getExpectedRuntimeId: () => readyRuntime.runtimeId
		});
		const coordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => null,
			getModelWorkaroundEnabled: () => false,
			quickTunnelVerificationDelayMs: 0,
			quickTunnel: quickTunnelDouble({
				state: 'running',
				url: 'https://quick.trycloudflare.com'
			})
		});

		await expect(coordinator.startQuickTunnel()).resolves.toMatchObject({ state: 'running', url: 'https://quick.trycloudflare.com' });
		expect(healthAttempts).toBe(3);
		expect(publicUrl.getState()).toMatchObject({
			state: 'authenticated_ready',
			url: 'https://quick.trycloudflare.com'
		});
		expect(coordinator.getCursorBaseUrl()).toBe('https://quick.trycloudflare.com/v1');
	});

	it('keeps retrying a slow Quick Tunnel route long enough for public health to become reachable', async () => {
		let healthAttempts = 0;
		const state = new InMemoryExtensionStateStore();
		const credentials = new InMemoryCredentialStore({ localApiKey: 'local-key' });
		const publicUrl = new PublicUrlManager({
			state,
			fetchImpl: async (input) => {
				const url = String(input);
				if (url.endsWith('/health')) {
					healthAttempts += 1;
					return healthAttempts < 20
						? new Response('warming up', { status: 502 })
						: jsonResponse({ status: 'ok' });
				}
				return jsonResponse({ ready: true, runtimeId: 'runtime-1' });
			},
			getLocalApiKey: () => credentials.getLocalApiKey(),
			getExpectedRuntimeId: () => readyRuntime.runtimeId
		});
		const coordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => null,
			getModelWorkaroundEnabled: () => false,
			quickTunnelVerificationDelayMs: 0,
			quickTunnel: quickTunnelDouble({
				state: 'running',
				url: 'https://quick.trycloudflare.com'
			})
		});

		await expect(coordinator.startQuickTunnel()).resolves.toMatchObject({ state: 'running', url: 'https://quick.trycloudflare.com' });
		expect(healthAttempts).toBe(20);
		expect(publicUrl.getState()).toMatchObject({ state: 'authenticated_ready' });
		expect(coordinator.getCursorBaseUrl()).toBe('https://quick.trycloudflare.com/v1');
	});

	it('does not expose a failed Quick Tunnel verification as Cursor-ready', async () => {
		const state = new InMemoryExtensionStateStore();
		const credentials = new InMemoryCredentialStore({ localApiKey: 'local-key' });
		const publicUrl = new PublicUrlManager({
			state,
			fetchImpl: async (input) => String(input).endsWith('/health')
				? jsonResponse({ status: 'ok' })
				: new Response(JSON.stringify({ ready: false, runtimeId: 'runtime-1' }), { status: 503 }),
			getLocalApiKey: () => credentials.getLocalApiKey(),
			getExpectedRuntimeId: () => readyRuntime.runtimeId
		});
		const coordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => null,
			getModelWorkaroundEnabled: () => false,
			quickTunnelVerificationDelayMs: 0,
			quickTunnelVerificationAttempts: 1,
			quickTunnel: quickTunnelDouble({
				state: 'running',
				url: 'https://quick.trycloudflare.com'
			})
		});

		await expect(coordinator.startQuickTunnel()).resolves.toMatchObject({ state: 'running', message: expect.stringMatching(/not authenticated-ready/i) });

		expect(publicUrl.getState()).toMatchObject({ state: 'route_health_ok', source: 'quick_tunnel', temporary: true });
		expect(coordinator.getCursorBaseUrl()).toBeNull();
	});

	it('stales only the matching Quick Tunnel public URL when stopping a tunnel', async () => {
		const state = new InMemoryExtensionStateStore();
		const credentials = new InMemoryCredentialStore({ localApiKey: 'local-key' });
		const publicUrl = new PublicUrlManager({
			state,
			fetchImpl: async (input) => String(input).endsWith('/health')
				? jsonResponse({ status: 'ok' })
				: jsonResponse({ ready: true, runtimeId: 'runtime-1' }),
			getLocalApiKey: () => credentials.getLocalApiKey(),
			getExpectedRuntimeId: () => readyRuntime.runtimeId
		});
		await publicUrl.verify('https://durable.example.com', { source: 'user_provided' });
		const durableCoordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => null,
			getModelWorkaroundEnabled: () => false,
			quickTunnel: quickTunnelDouble({ state: 'running', url: 'https://quick.trycloudflare.com' })
		});

		await durableCoordinator.stopQuickTunnel();
		expect(publicUrl.getState()).toMatchObject({ state: 'authenticated_ready', source: 'user_provided', temporary: false });

		await publicUrl.verify('https://quick.trycloudflare.com', { source: 'quick_tunnel' });
		const quickCoordinator = new SetupCoordinator({
			state,
			credentials,
			publicUrl,
			getRuntimeSnapshot: () => readyRuntime,
			getCodexAuthState: async () => 'authenticated',
			getInternalStatus: async () => null,
			getModelWorkaroundEnabled: () => false,
			quickTunnel: quickTunnelDouble({ state: 'running', url: 'https://quick.trycloudflare.com' })
		});
		await quickCoordinator.stopQuickTunnel();
		expect(publicUrl.getState()).toMatchObject({
			state: 'route_health_ok',
			source: 'quick_tunnel',
			temporary: true,
			message: expect.stringMatching(/stopped/i)
		});
	});
});

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

function quickTunnelDouble(status: { state: Parameters<typeof createQuickTunnelStatus>[0]; url?: string | null; message?: string | null }): QuickTunnelManager {
	let current = createQuickTunnelStatus(status.state, status.url ?? null, status.message ?? null);
	return {
		getStatus: () => current,
		start: async () => current,
		restart: async () => current,
		stop: async () => {
			current = createQuickTunnelStatus('stopped');
			return current;
		}
	} as unknown as QuickTunnelManager;
}
