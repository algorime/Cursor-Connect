import { createEmptyApiTrafficStatus, createQuickTunnelStatus, type RuntimeSnapshot } from '@codex-auth-ext/shared';
import { describe, expect, it } from 'vitest';

import { buildExtensionSetupState } from '../src/setup/setup-state.js';

const runtime: RuntimeSnapshot = {
	phase: 'running_health_only',
	failureCategory: 'none',
	localTargetUrl: 'http://127.0.0.1:50000',
	port: 50000,
	message: 'Codex auth required',
	updatedAt: 1,
	runtimeId: 'runtime-1'
};

describe('buildExtensionSetupState', () => {
	it('promotes Codex auth as the active blocker on a fresh health-only runtime', () => {
		const state = buildExtensionSetupState({
			runtime,
			codexAuthState: 'not_configured',
			publicUrl: { url: null, state: 'not_configured', source: null, temporary: false },
			apiTraffic: createEmptyApiTrafficStatus(),
			cursorSetup: { manualConfirmed: false },
			modelWorkaround: 'decide_later',
			tunnel: createQuickTunnelStatus('not_started'),
			usageStorageState: 'ready',
			environmentLabel: 'local',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced'
		});

		expect(state.items.find((item) => item.id === 'codex-auth')).toMatchObject({ status: 'active' });
		expect(state.items.find((item) => item.id === 'public-url')).toMatchObject({ status: 'pending' });
		expect(state.environmentLabel).toBe('local');
		expect(state.statusBarPreference).toBe('visible');
		expect(state.notificationPreference).toBe('balanced');
		expect(state.readiness).toMatchObject({ state: 'setup', blockers: expect.arrayContaining(['Codex authentication']) });
	});

	it('marks Cursor setup complete only after manual confirmation and current-generation traffic detection', () => {
		const state = buildExtensionSetupState({
			runtime: { ...runtime, phase: 'ready', message: null },
			codexAuthState: 'authenticated',
			publicUrl: { url: 'https://codex.example.com', state: 'authenticated_ready', source: 'user_provided', temporary: false, runtimeId: 'runtime-1' },
			apiTraffic: { lastCursorFacingRequest: { method: 'GET', path: '/v1/models', at: 123 } },
			cursorSetup: { manualConfirmed: true, confirmedAt: 100 },
			modelWorkaround: 'enabled',
			tunnel: createQuickTunnelStatus('not_started'),
			usageStorageState: 'ready',
			environmentLabel: 'local',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced'
		});

		expect(state.items.find((item) => item.id === 'cursor-setup')).toMatchObject({ status: 'complete' });
		expect(state.readiness).toMatchObject({ state: 'ready' });
		expect(state.localTargetUrl).toBe('http://127.0.0.1:50000');
		expect(state.publicUrl.url).toBe('https://codex.example.com');
	});

	it('does not block Ready on the dormant workaround and ignores stale historical traffic', () => {
		const undecided = buildExtensionSetupState({
			runtime: { ...runtime, phase: 'ready', message: null },
			codexAuthState: 'authenticated',
			publicUrl: { url: 'https://quick.trycloudflare.com', state: 'authenticated_ready', source: 'quick_tunnel', temporary: true, runtimeId: 'runtime-1' },
			apiTraffic: { lastCursorFacingRequest: { method: 'GET', path: '/v1/models', at: 123 } },
			cursorSetup: { manualConfirmed: true, confirmedAt: 100 },
			modelWorkaround: 'decide_later',
			tunnel: createQuickTunnelStatus('running', 'https://quick.trycloudflare.com'),
			usageStorageState: 'degraded',
			environmentLabel: 'local',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced'
		});
		const staleTraffic = buildExtensionSetupState({
			runtime: { ...runtime, phase: 'ready', message: null },
			codexAuthState: 'authenticated',
			publicUrl: { url: 'https://codex.example.com', state: 'authenticated_ready', source: 'user_provided', temporary: false, runtimeId: 'runtime-1' },
			apiTraffic: { lastCursorFacingRequest: { method: 'GET', path: '/v1/models', at: 50 } },
			cursorSetup: { manualConfirmed: true, confirmedAt: 100 },
			modelWorkaround: 'skipped',
			tunnel: createQuickTunnelStatus('not_started'),
			usageStorageState: 'ready',
			environmentLabel: 'local',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced'
		});

		expect(undecided.items.find((item) => item.id === 'harness-workaround')).toMatchObject({
			label: 'Model compatibility fallback',
			status: 'warning'
		});
		expect(undecided.readiness).toMatchObject({
			state: 'ready',
			blockers: [],
			warnings: expect.arrayContaining(['Model compatibility fallback', 'Usage storage', 'Temporary Extension Base URL'])
		});
		expect(staleTraffic.items.find((item) => item.id === 'cursor-setup')).toMatchObject({ status: 'active' });
		expect(staleTraffic.readiness).toMatchObject({ state: 'setup' });
	});

	it('does not keep a Quick Tunnel-backed URL ready after the tunnel exits or changes URL', () => {
		const state = buildExtensionSetupState({
			runtime: { ...runtime, phase: 'ready', message: null },
			codexAuthState: 'authenticated',
			publicUrl: { url: 'https://old.trycloudflare.com', state: 'authenticated_ready', source: 'quick_tunnel', temporary: true, runtimeId: 'runtime-1' },
			apiTraffic: { lastCursorFacingRequest: { method: 'GET', path: '/v1/models', at: 123 } },
			cursorSetup: { manualConfirmed: true, confirmedAt: 100 },
			modelWorkaround: 'enabled',
			tunnel: createQuickTunnelStatus('exited', null, 'process exited'),
			usageStorageState: 'ready',
			environmentLabel: 'local',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced'
		});

		expect(state.publicUrl).toMatchObject({
			state: 'route_health_ok',
			source: 'quick_tunnel',
			temporary: true,
			message: expect.stringMatching(/Quick Tunnel is no longer running/i)
		});
		expect(state.items.find((item) => item.id === 'public-url')).toMatchObject({ status: 'active' });
		expect(state.readiness).toMatchObject({
			state: 'setup',
			blockers: expect.arrayContaining(['Public Extension Base URL'])
		});
	});

	it('downgrades authenticated ready public routes when runtime proof is missing or mismatched', () => {
		const missingProof = buildExtensionSetupState({
			runtime: { ...runtime, phase: 'ready', message: null },
			codexAuthState: 'authenticated',
			publicUrl: { url: 'https://codex.example.com', state: 'authenticated_ready', source: 'user_provided', temporary: false },
			apiTraffic: createEmptyApiTrafficStatus(),
			cursorSetup: { manualConfirmed: false },
			modelWorkaround: 'enabled',
			tunnel: createQuickTunnelStatus('not_started'),
			usageStorageState: 'ready',
			environmentLabel: 'local',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced'
		});
		const mismatchedProof = buildExtensionSetupState({
			runtime: { ...runtime, phase: 'ready', message: null },
			codexAuthState: 'authenticated',
			publicUrl: { url: 'https://codex.example.com', state: 'authenticated_ready', source: 'user_provided', temporary: false, runtimeId: 'old-runtime' },
			apiTraffic: createEmptyApiTrafficStatus(),
			cursorSetup: { manualConfirmed: false },
			modelWorkaround: 'enabled',
			tunnel: createQuickTunnelStatus('not_started'),
			usageStorageState: 'ready',
			environmentLabel: 'local',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced'
		});

		expect(missingProof.publicUrl).toMatchObject({ state: 'wrong_runtime' });
		expect(mismatchedProof.publicUrl).toMatchObject({ state: 'wrong_runtime' });
		expect(mismatchedProof.items.find((item) => item.id === 'public-url')).toMatchObject({ status: 'active' });
		expect(mismatchedProof.readiness).toMatchObject({
			state: 'setup',
			blockers: expect.arrayContaining(['Public Extension Base URL'])
		});
	});

});
