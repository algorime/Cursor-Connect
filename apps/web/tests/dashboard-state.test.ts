import { createEmptyApiTrafficStatus, createQuickTunnelStatus, type SetupState } from '@codex-auth-ext/shared';
import { describe, expect, it } from 'vitest';

import { buildDashboardHomeViewModel, buildDashboardViewModel, buildDiagnosticsViewModel, shortenUrlForHome } from '../src/dashboard-state.js';

describe('dashboard home view model', () => {
	it('prioritizes the setup checklist until the extension base URL and Cursor traffic are verified', () => {
		const state: SetupState = {
			generatedAt: 1,
			environmentLabel: 'Current extension host',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'decide_later',
			localTargetUrl: 'http://127.0.0.1:49152',
			publicUrl: { url: 'https://codex.example.com', state: 'route_health_ok', source: 'user_provided', temporary: false },
			apiTraffic: createEmptyApiTrafficStatus(),
			tunnel: createQuickTunnelStatus('running', 'https://abc.trycloudflare.com'),
			readiness: { state: 'setup', blockers: ['Public Extension Base URL'], warnings: ['Temporary Quick Tunnel'] },
			items: [
				{ id: 'runtime', label: 'Local API runtime', status: 'complete', guidance: 'ready' },
				{ id: 'codex-auth', label: 'Codex authentication', status: 'complete', guidance: 'ready' },
				{ id: 'public-url', label: 'Public Extension Base URL', status: 'active', guidance: 'verify /ready' },
				{ id: 'cursor-setup', label: 'Cursor setup', status: 'pending', guidance: 'paste settings' }
			]
		};

		const view = buildDashboardHomeViewModel(state);

		expect(view.mode).toBe('setup');
		expect(view.headline).toBe('Finish Codex setup');
		expect(view.blockingItem?.id).toBe('public-url');
		expect(view.badges).toContain('Temporary Quick Tunnel');
	});

	it('keeps Codex authentication ahead of public URL setup in the next-action order', () => {
		const state: SetupState = {
			generatedAt: 1,
			environmentLabel: 'Current extension host',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'decide_later',
			localTargetUrl: 'http://127.0.0.1:49152',
			publicUrl: { url: null, state: 'not_configured', source: null, temporary: false },
			apiTraffic: createEmptyApiTrafficStatus(),
			tunnel: createQuickTunnelStatus('not_started'),
			readiness: { state: 'setup', blockers: ['Codex authentication', 'Public Extension Base URL'], warnings: [] },
			items: [
				{ id: 'runtime', label: 'Local API runtime', status: 'complete', guidance: 'ready' },
				{ id: 'codex-auth', label: 'Codex authentication', status: 'active', guidance: 'sign in' },
				{ id: 'public-url', label: 'Public Extension Base URL', status: 'pending', guidance: 'start tunnel' }
			]
		};

		const view = buildDashboardHomeViewModel(state);

		expect(view.nextAction).toMatchObject({
			id: 'sign_in_codex',
			label: 'Complete Codex authentication',
			primary: 'sign_in_codex',
			secondary: 'import_codex_auth'
		});
	});

	it('uses explicit readiness authority instead of treating a complete checklist as ready', () => {
		const state: SetupState = {
			generatedAt: 1,
			environmentLabel: 'Current extension host',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'skipped',
			localTargetUrl: 'http://127.0.0.1:49152',
			publicUrl: { url: 'https://codex.example.com', state: 'authenticated_ready', source: 'user_provided', temporary: false },
			apiTraffic: { lastCursorFacingRequest: { method: 'GET', path: '/v1/models', at: 10 } },
			tunnel: createQuickTunnelStatus('not_started'),
			readiness: { state: 'setup', blockers: ['Cursor setup'], warnings: [] },
			items: [
				{ id: 'runtime', label: 'Local API runtime', status: 'complete', guidance: 'ready' },
				{ id: 'codex-auth', label: 'Codex authentication', status: 'complete', guidance: 'ready' },
				{ id: 'public-url', label: 'Public Extension Base URL', status: 'complete', guidance: 'ready' },
				{ id: 'harness-workaround', label: 'Harness Routing Workaround', status: 'complete', guidance: 'skipped' },
				{ id: 'cursor-setup', label: 'Cursor setup', status: 'complete', guidance: 'confirmed' },
				{ id: 'usage-storage', label: 'Usage storage', status: 'complete', guidance: 'ready' }
			]
		};

		const view = buildDashboardHomeViewModel(state);

		expect(view.mode).toBe('setup');
		expect(view.nextAction.id).toBe('mark_cursor_confirmed');
	});

	it('switches from copy setup to traffic verification after manual confirmation', () => {
		const state: SetupState = {
			generatedAt: 1,
			environmentLabel: 'Current extension host',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'enabled',
			localTargetUrl: 'http://127.0.0.1:49152',
			publicUrl: { url: 'https://codex.example.com', state: 'authenticated_ready', source: 'user_provided', temporary: false },
			apiTraffic: createEmptyApiTrafficStatus(),
			cursorSetup: { manualConfirmed: true, confirmedAt: 100 },
			tunnel: createQuickTunnelStatus('not_started'),
			readiness: { state: 'setup', blockers: ['Cursor setup'], warnings: [] },
			items: [
				{ id: 'runtime', label: 'Local API runtime', status: 'complete', guidance: 'ready' },
				{ id: 'codex-auth', label: 'Codex authentication', status: 'complete', guidance: 'ready' },
				{ id: 'public-url', label: 'Public Extension Base URL', status: 'complete', guidance: 'ready' },
				{ id: 'harness-workaround', label: 'Harness Routing Workaround', status: 'complete', guidance: 'enabled' },
				{ id: 'cursor-setup', label: 'Cursor setup', status: 'active', guidance: 'waiting for traffic' }
			]
		};

		const view = buildDashboardHomeViewModel(state);

		expect(view.nextAction).toMatchObject({
			id: 'open_cursor_settings',
			label: 'Open Cursor and send a test request',
			primary: 'open_cursor_settings',
			secondary: 'run_doctor'
		});
	});

	it('builds nav, setup facts, next action, and disabled future affordances', () => {
		const state: SetupState = {
			generatedAt: 1,
			environmentLabel: 'Remote SSH extension host',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'decide_later',
			openAiKeyRepair: { decision: 'enabled', capability: 'available' },
			localTargetUrl: 'http://127.0.0.1:49152',
			publicUrl: { url: null, state: 'not_configured', source: null, temporary: false },
			apiTraffic: createEmptyApiTrafficStatus(),
			tunnel: createQuickTunnelStatus('not_started'),
			readiness: { state: 'setup', blockers: ['Public Extension Base URL'], warnings: [] },
			items: [
				{ id: 'runtime', label: 'Local API runtime', status: 'complete', guidance: 'ready' },
				{ id: 'codex-auth', label: 'Codex authentication', status: 'complete', guidance: 'ready' },
				{ id: 'public-url', label: 'Public Extension Base URL', status: 'active', guidance: 'start or verify a public route' },
				{ id: 'harness-workaround', label: 'Harness Routing Workaround', status: 'pending', guidance: 'decide later' },
				{ id: 'cursor-setup', label: 'Cursor setup', status: 'pending', guidance: 'copy setup' }
			]
		};

		const view = buildDashboardViewModel(state, { activePage: 'usage' });

		expect(view.activePage).toBe('home');
		expect(view.nav.filter((item) => item.disabled).map((item) => item.label)).toEqual(['Usage', 'Accounts', 'Logs & Support']);
		expect(view.nav.find((item) => item.id === 'usage')).toMatchObject({ active: false, badge: 'Later' });
		expect(view.home.nextAction).toMatchObject({ id: 'start_quick_tunnel', primary: 'start_quick_tunnel' });
		expect(view.setup).toMatchObject({
			localTargetUrl: 'http://127.0.0.1:49152',
			publicRouteUrl: null,
			cursorExtensionBaseUrl: null,
			statusMessages: [],
			canCopyFinalSetup: false,
			canCopyBaseUrl: false,
			openAiKeyRepairDecision: 'enabled',
			modelDecisionRequired: false
		});
		expect(view.preferences.openAiKeyRepairDecision).toBe('enabled');
		expect(view.setup.durableExamples.map((example) => example.label)).toContain('Cloudflare named tunnel');
	});

	it('keeps shortened URLs on Home while retaining full values for Setup', () => {
		const state: SetupState = {
			generatedAt: 1,
			environmentLabel: 'host',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'enabled',
			localTargetUrl: 'http://127.0.0.1:49152',
			publicUrl: { url: 'https://quick.trycloudflare.com', state: 'authenticated_ready', source: 'quick_tunnel', temporary: true },
			apiTraffic: createEmptyApiTrafficStatus(),
			tunnel: createQuickTunnelStatus('running', 'https://quick.trycloudflare.com'),
			readiness: { state: 'setup', blockers: ['Cursor setup'], warnings: ['Temporary Extension Base URL'] },
			items: [
				{ id: 'runtime', label: 'Local API runtime', status: 'complete', guidance: 'ready' },
				{ id: 'codex-auth', label: 'Codex authentication', status: 'complete', guidance: 'ready' },
				{ id: 'public-url', label: 'Public Extension Base URL', status: 'complete', guidance: 'ready' },
				{ id: 'harness-workaround', label: 'Harness Routing Workaround', status: 'complete', guidance: 'enabled' },
				{ id: 'cursor-setup', label: 'Cursor setup', status: 'active', guidance: 'copy setup' }
			]
		};

		const view = buildDashboardViewModel(state, { activePage: 'setup' });

		expect(shortenUrlForHome('https://codex.example.com/base/v1')).toBe('codex.example.com/base/v1');
		expect(view.home.facts).toContainEqual(expect.objectContaining({
			label: 'Temporary route',
			value: 'quick.trycloudflare.com',
			fullValue: 'https://quick.trycloudflare.com'
		}));
		expect(view.setup.publicRouteUrl).toBe('https://quick.trycloudflare.com');
		expect(view.setup.publicRouteUrlLabel).toBe('Temporary Public Route URL');
		expect(view.setup.cursorExtensionBaseUrl).toBe('https://quick.trycloudflare.com/v1');
		expect(view.home.warningChips).toContain('Temporary Extension Base URL');
	});

	it('carries public URL and tunnel failure messages into Setup', () => {
		const state: SetupState = {
			generatedAt: 1,
			environmentLabel: 'host',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'decide_later',
			localTargetUrl: 'http://127.0.0.1:49152',
			publicUrl: { url: 'https://quick.trycloudflare.com', state: 'route_health_ok', source: 'quick_tunnel', temporary: true, message: 'Public URL is live but /ready is not authenticated-ready' },
			apiTraffic: createEmptyApiTrafficStatus(),
			tunnel: createQuickTunnelStatus('running', 'https://quick.trycloudflare.com', 'Quick Tunnel started, but verification failed'),
			readiness: { state: 'setup', blockers: ['Public Extension Base URL'], warnings: [] },
			items: [
				{ id: 'runtime', label: 'Local API runtime', status: 'complete', guidance: 'ready' },
				{ id: 'codex-auth', label: 'Codex authentication', status: 'complete', guidance: 'ready' },
				{ id: 'public-url', label: 'Public Extension Base URL', status: 'active', guidance: 'verify route' }
			]
		};

		const view = buildDashboardViewModel(state);

		expect(view.setup.statusMessages).toEqual([
			'Quick Tunnel started, but verification failed',
			'Public URL is live but /ready is not authenticated-ready'
		]);
	});

	it('guides stale Quick Tunnel users to restart the tunnel and update Cursor settings', () => {
		const state: SetupState = {
			generatedAt: 1,
			environmentLabel: 'host',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'enabled',
			localTargetUrl: 'http://127.0.0.1:49152',
			publicUrl: {
				url: 'https://old.trycloudflare.com',
				state: 'route_health_ok',
				source: 'quick_tunnel',
				temporary: true,
				message: 'Quick Tunnel URL is stale or no longer resolvable by Cloudflare. Restart Quick Tunnel, copy the new Extension Base URL, and update Cursor settings.'
			},
			apiTraffic: createEmptyApiTrafficStatus(),
			tunnel: createQuickTunnelStatus('exited', null, 'process exited'),
			readiness: { state: 'setup', blockers: ['Public Extension Base URL'], warnings: [] },
			items: [
				{ id: 'runtime', label: 'Local API runtime', status: 'complete', guidance: 'ready' },
				{ id: 'codex-auth', label: 'Codex authentication', status: 'complete', guidance: 'ready' },
				{ id: 'public-url', label: 'Public Extension Base URL', status: 'active', guidance: 'restart tunnel' }
			]
		};

		const view = buildDashboardViewModel(state);

		expect(view.home.nextAction).toMatchObject({
			id: 'start_quick_tunnel',
			label: 'Restart Quick Tunnel',
			description: expect.stringMatching(/copy.*Extension Base URL.*update Cursor/i)
		});
		expect(view.setup.commandCenter.route).toMatchObject({
			title: 'Temporary Quick Tunnel is stale',
			primaryLabel: 'Restart Quick Tunnel',
			summary: expect.stringMatching(/update Cursor settings/i)
		});
	});

	it('maps doctor reports into grouped diagnostic cards without raw JSON as the view model', () => {
		const diagnostics = buildDiagnosticsViewModel({
			generatedAt: 1,
			checks: [],
			groups: {
				pass: [{ id: 'runtime', label: 'Runtime', status: 'pass', guidance: 'ready' }],
				warn: [{ id: 'tunnel', label: 'Quick Tunnel', status: 'warn', guidance: 'temporary' }],
				fail: [{ id: 'auth', label: 'Auth', status: 'fail', guidance: 'sign in' }]
			}
		});

		expect(diagnostics.groups.pass[0]).toMatchObject({ id: 'runtime', status: 'pass' });
		expect(diagnostics.groups.warn[0]).toMatchObject({ label: 'Quick Tunnel' });
		expect(diagnostics.groups.fail[0]).toMatchObject({ guidance: 'sign in' });
	});

	it('builds auth and route command-center facts with root URL and Cursor /v1 value separated', () => {
		const state: SetupState = {
			generatedAt: 1,
			environmentLabel: 'host',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'enabled',
			localTargetUrl: 'http://127.0.0.1:49152',
			publicUrl: { url: 'https://codex.example.com/base', state: 'authenticated_ready', source: 'user_provided', temporary: false, runtimeId: 'runtime-1' },
			apiTraffic: createEmptyApiTrafficStatus(),
			tunnel: createQuickTunnelStatus('not_started'),
			readiness: { state: 'setup', blockers: ['Cursor setup'], warnings: [] },
			items: [
				{ id: 'runtime', label: 'Local API runtime', status: 'complete', guidance: 'ready' },
				{ id: 'codex-auth', label: 'Codex authentication', status: 'complete', guidance: 'ready' },
				{ id: 'public-url', label: 'Public Extension Base URL', status: 'complete', guidance: 'ready' }
			]
		};

		const view = buildDashboardViewModel(state);

		expect(view.home.commandCenter.auth).toMatchObject({
			title: 'Codex Auth ready',
			primaryAction: 'recheck_auth'
		});
		expect(view.setup.commandCenter.route.facts).toContainEqual(expect.objectContaining({
			label: 'Public Route URL',
			value: 'https://codex.example.com/base'
		}));
		expect(view.setup.commandCenter.route.facts).toContainEqual(expect.objectContaining({
			label: 'Cursor Extension Base URL',
			value: 'https://codex.example.com/base/v1'
		}));
		expect(view.setup).toMatchObject({
			publicRouteUrl: 'https://codex.example.com/base',
			publicRouteUrlLabel: 'Durable Public Route URL',
			cursorExtensionBaseUrl: 'https://codex.example.com/base/v1'
		});
		expect(view.setup.commandCenter.route.facts).toContainEqual(expect.objectContaining({
			label: 'Runtime Proof',
			value: 'current: runtime-1'
		}));
	});

	it('keeps OpenAI-key repair capability visible and non-working when unavailable', () => {
		const state: SetupState = {
			generatedAt: 1,
			environmentLabel: 'host',
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'decide_later',
			openAiKeyRepair: { decision: 'decide_later', capability: 'unavailable', reason: 'not_found' },
			localTargetUrl: 'http://127.0.0.1:49152',
			publicUrl: { url: null, state: 'not_configured', source: null, temporary: false },
			apiTraffic: createEmptyApiTrafficStatus(),
			tunnel: createQuickTunnelStatus('not_started'),
			readiness: { state: 'setup', blockers: [], warnings: [] },
			items: []
		};

		const view = buildDashboardViewModel(state);

		expect(view.setup.openAiKeyRepair).toMatchObject({
			capability: 'unavailable',
			unavailable: true,
			disabledReason: 'OpenAI-key repair is unavailable on this host and is not required for Ready.'
		});
		expect(view.setup.openAiKeyRepair.summary).toContain('Unavailable on this host');
		expect(view.preferences.openAiKeyRepair).toEqual(view.setup.openAiKeyRepair);
	});

});
