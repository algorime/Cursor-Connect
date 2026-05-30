// @vitest-environment jsdom

import {
	createEmptyApiTrafficStatus,
	createQuickTunnelStatus,
	type DoctorReport,
	type SetupChecklistItem,
	type SetupState
} from '@codex-auth-ext/shared';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('dashboard webview mount', () => {
	afterEach(() => {
		const teardown = Reflect.get(globalThis, '__codexAuthDashboardTeardown');
		if (typeof teardown === 'function') {
			teardown();
		}
		vi.useRealTimers();
		vi.resetModules();
		Reflect.deleteProperty(globalThis, 'acquireVsCodeApi');
		document.body.innerHTML = '';
	});

	it('renders visible fallback content immediately and requests setup state from the extension', async () => {
		const messages: unknown[] = [];
		document.body.innerHTML = '<div id="app"></div>';
		Reflect.set(globalThis, 'acquireVsCodeApi', () => ({
			postMessage: (message: unknown) => messages.push(message)
		}));

		await import('../src/main.js');

		expect(document.body.textContent).toContain('Loading Codex dashboard');
		expect(messages).toEqual([
			expect.objectContaining({ type: 'dashboard.getSetupState' })
		]);
	});

	it('renders the setup checklist after receiving setup state', async () => {
		await mountDashboard([]);
		postSetupState(makeSetupState());
		await tick();

		expect(document.body.textContent).toContain('Finish Codex setup');
		expect(document.body.textContent).toContain('Local API runtime');
		expect(document.body.textContent).toContain('Public Extension Base URL');
		expect(document.querySelector('.button-grid')).toBeNull();
	});

	it('renders polished nav and prevents disabled future pages from routing', async () => {
		await mountDashboard([]);
		postSetupState(makeSetupState());
		await tick();

		expect(buttonByText('Home')?.disabled).toBe(false);
		expect(buttonByText('Setup')?.disabled).toBe(false);
		expect(buttonByText('Diagnostics')?.disabled).toBe(false);
		expect(buttonByText('Preferences')?.disabled).toBe(false);
		expect(buttonByText('Usage')?.disabled).toBe(true);
		expect(buttonByText('Accounts')?.disabled).toBe(true);
		expect(buttonByText('Logs & Support')?.disabled).toBe(true);
		expect(document.body.textContent).toContain('Later');

		buttonByText('Setup')?.click();
		await tick();
		expect(document.body.textContent).toContain('Configure Cursor with Codex');
		buttonByText('Usage')?.click();
		await tick();
		expect(document.body.textContent).toContain('Configure Cursor with Codex');
	});

	it('renders setup in deliberate order and sends full setup copy through the bridge without rendering secrets', async () => {
		const messages: unknown[] = [];
		await mountDashboard(messages);
		postSetupState(makeSetupState({
			modelWorkaroundDecision: 'enabled',
			publicUrl: {
				url: 'https://stable.example.com',
				state: 'authenticated_ready',
				source: 'user_provided',
				temporary: false
			},
			items: [
				item('runtime', 'Local API runtime', 'complete', 'ready'),
				item('codex-auth', 'Codex authentication', 'complete', 'auth ready'),
				item('public-url', 'Public Extension Base URL', 'complete', 'verified'),
				item('harness-workaround', 'Harness Routing Workaround', 'complete', 'enabled'),
				item('cursor-setup', 'Cursor setup', 'active', 'copy values')
			]
		}));
		await tick();

		buttonByText('Setup')?.click();
		await tick();
		const text = document.body.textContent ?? '';
		expect(text.indexOf('1 · Fast Start')).toBeLessThan(text.indexOf('2 · Stable Setup'));
		expect(text.indexOf('2 · Stable Setup')).toBeLessThan(text.indexOf('3 · Cursor Setup'));
		expect(text.indexOf('3 · Cursor Setup')).toBeLessThan(text.indexOf('4 · Security / Repair'));
		expect(text).toContain('Durable Public Route URL');
		expect(text).toContain('Cursor Extension Base URL');
		expect(text).not.toContain('Advanced · Model fallback');
		expect(text).toContain('API key is copy-only and is never displayed here');
		expect(text).not.toContain('sk-local-secret');

		buttonByText('Copy full Cursor setup instructions')?.click();
		await tick();
		expect(messages).toContainEqual(expect.objectContaining({
			type: 'dashboard.copyCursorSetup',
			copyKind: 'full'
		}));
	});

	it('renders structured doctor groups with collapsed safe details', async () => {
		await mountDashboard([]);
		postSetupState(makeSetupState());
		await tick();
		postDoctorReport();
		await tick();

		buttonByText('Diagnostics')?.click();
		await tick();

		expect(document.body.textContent).toContain('FAIL');
		expect(document.body.textContent).toContain('WARN');
		expect(document.body.textContent).toContain('PASS');
		expect(document.body.textContent).toContain('Public URL not ready');
		const details = document.querySelector('details');
		expect(details?.textContent).toContain('Safe details');
		expect(details?.querySelector('pre')).not.toBeNull();
	});

	it('shows immediate pending feedback and setup-copy locks before the extension responds', async () => {
		const messages: unknown[] = [];
		await mountDashboard(messages);
		postSetupState(makeSetupState());
		await tick();

		buttonByText('Setup')?.click();
		await tick();
		buttonByText('Start Quick Tunnel')?.click();
		await tick();

		expect(messages).toContainEqual(expect.objectContaining({ type: 'dashboard.startQuickTunnel' }));
		expect(document.body.textContent).toContain('Start Quick Tunnel in progress');
		expect(document.body.textContent).toContain('Wait for setup to finish before copying values.');
		expect(buttonByText('Copy local API key')?.disabled).toBe(true);
	});

	it('keeps the global activity dock visible while navigating pages', async () => {
		const messages: unknown[] = [];
		await mountDashboard(messages);
		postSetupState(makeSetupState());
		await tick();

		buttonByText('Setup')?.click();
		await tick();
		buttonByText('Start Quick Tunnel')?.click();
		await tick();
		buttonByText('Diagnostics')?.click();
		await tick();

		expect(document.body.textContent).toContain('Doctor checks');
		expect(document.body.textContent).toContain('Start Quick Tunnel in progress');
		expect(document.querySelector('.activity-dock')?.textContent).toContain('Start Quick Tunnel in progress');
	});

	it('clears Home-started Quick Tunnel pending state when the follow-up setup refresh unlocks copying', async () => {
		const messages: Array<{ requestId?: string; type?: string }> = [];
		await mountDashboard(messages);
		postSetupState(makeSetupState({
			modelWorkaroundDecision: 'enabled',
			items: [
				item('runtime', 'Local API runtime', 'complete', 'ready'),
				item('codex-auth', 'Codex authentication', 'complete', 'auth ready'),
				item('public-url', 'Public Extension Base URL', 'active', 'start tunnel'),
				item('harness-workaround', 'Harness Routing Workaround', 'complete', 'enabled'),
				item('cursor-setup', 'Cursor setup', 'pending', 'copy values')
			]
		}));
		await tick();

		buttonByText('Start Quick Tunnel')?.click();
		await tick();
		const startRequest = messages.find((message) => message.type === 'dashboard.startQuickTunnel')?.requestId;
		expect(startRequest).toBeTruthy();

		window.dispatchEvent(new MessageEvent('message', {
			data: {
				requestId: startRequest,
				type: 'extension.quickTunnelStatus',
				status: createQuickTunnelStatus('running', 'https://quick.trycloudflare.com')
			}
		}));
		await tick();
		expect(messages).toContainEqual(expect.objectContaining({
			type: 'dashboard.getSetupState',
			requestId: startRequest
		}));

		postSetupState(makeSetupState({
			modelWorkaroundDecision: 'enabled',
			publicUrl: {
				url: 'https://quick.trycloudflare.com',
				state: 'authenticated_ready',
				source: 'quick_tunnel',
				temporary: true
			},
			tunnel: createQuickTunnelStatus('running', 'https://quick.trycloudflare.com'),
			items: [
				item('runtime', 'Local API runtime', 'complete', 'ready'),
				item('codex-auth', 'Codex authentication', 'complete', 'auth ready'),
				item('public-url', 'Public Extension Base URL', 'complete', 'verified'),
				item('harness-workaround', 'Harness Routing Workaround', 'complete', 'enabled'),
				item('cursor-setup', 'Cursor setup', 'active', 'copy values')
			]
		}), startRequest);
		await tick();

		buttonByText('Setup')?.click();
		await tick();
		expect(document.body.textContent).not.toContain('Start Quick Tunnel in progress');
		expect(buttonByText('Copy full Cursor setup instructions')?.disabled).toBe(false);
	});

	it('renders preferences as selected choice cards without raw enum labels', async () => {
		const messages: unknown[] = [];
		await mountDashboard(messages);
		postSetupState(makeSetupState({
			statusBarPreference: 'visible',
			notificationPreference: 'balanced',
			modelWorkaroundDecision: 'decide_later'
		}));
		await tick();

		buttonByText('Preferences')?.click();
		await tick();

		const text = document.body.textContent ?? '';
		expect(text).toContain('Visible');
		expect(text).toContain('Balanced');
		expect(text).not.toContain('Model workaround');
		expect(text).not.toContain('Dormant');
		expect(text).toContain('Selected');
		expect(text).not.toContain('important_only');
		expect(text).not.toContain('decide_later');
		expect(document.querySelectorAll('.choice-selected').length).toBeGreaterThanOrEqual(2);

		buttonContaining('Important only')?.click();
		await tick();

		expect(messages).toContainEqual(expect.objectContaining({
			type: 'dashboard.setNotificationPreference',
			preference: 'important_only'
		}));
		expect(document.querySelector('.choice-selected')?.textContent).toBeTruthy();
		expect(document.body.textContent).toContain('Updating notifications…');
	});

	it('keeps OpenAI-key repair selection after the extension refreshes setup state', async () => {
		const messages: unknown[] = [];
		await mountDashboard(messages);
		postSetupState(makeSetupState());
		await tick();

		buttonByText('Setup')?.click();
		await tick();
		buttonsContaining('Enabled').at(-1)?.click();
		await tick();

		const repairRequest = (messages as Array<{ type?: string; requestId?: string }>).find((message) => message.type === 'dashboard.setOpenAiKeyRepairDecision')?.requestId;
		expect(repairRequest).toBeTruthy();
		postSetupState(makeSetupState({
			openAiKeyRepair: { decision: 'enabled', capability: 'available' }
		}), repairRequest);
		await tick();

		const selectedCards = Array.from(document.querySelectorAll('.choice-selected'));
		expect(selectedCards.some((card) => card.textContent?.includes('Enabled') && card.textContent.includes('Use the compatibility repair'))).toBe(true);
	});

	it('shows unavailable OpenAI-key repair as non-working and non-blocking', async () => {
		await mountDashboard([]);
		postSetupState(makeSetupState({
			openAiKeyRepair: { decision: 'decide_later', capability: 'unavailable', reason: 'not_found' }
		}));
		await tick();

		buttonByText('Setup')?.click();
		await tick();

		const text = document.body.textContent ?? '';
		expect(text).toContain('Unavailable on this host / not required for Ready');
		expect(text).not.toContain('Use the compatibility repair when available');
		expect(buttonByText('Enabled')).toBeNull();
	});

	it('uses dashboard-native two-step confirmation for local API key rotation', async () => {
		const messages: unknown[] = [];
		const confirmSpy = vi.spyOn(window, 'confirm');
		await mountDashboard(messages);
		postSetupState(makeSetupState());
		await tick();

		buttonByText('Setup')?.click();
		await tick();
		buttonByText('Rotate local API key')?.click();
		await tick();

		expect(confirmSpy).not.toHaveBeenCalled();
		expect(messages).not.toContainEqual(expect.objectContaining({ type: 'dashboard.rotateLocalApiKey' }));
		expect(document.body.textContent).toContain('The old Cursor API key will stop working');
		expect(document.body.textContent).toContain('Codex OAuth tokens are not affected');

		buttonByText('Confirm Rotate local API key')?.click();
		await tick();

		expect(messages).toContainEqual(expect.objectContaining({ type: 'dashboard.rotateLocalApiKey' }));
	});

	it('copy pending only disables the copy action and not setup mutations', async () => {
		const messages: unknown[] = [];
		await mountDashboard(messages);
		postSetupState(makeSetupState({
			modelWorkaroundDecision: 'enabled',
			publicUrl: {
				url: 'https://stable.example.com',
				state: 'authenticated_ready',
				source: 'user_provided',
				temporary: false
			},
			items: [
				item('runtime', 'Local API runtime', 'complete', 'ready'),
				item('codex-auth', 'Codex authentication', 'complete', 'auth ready'),
				item('public-url', 'Public Extension Base URL', 'complete', 'verified'),
				item('harness-workaround', 'Harness Routing Workaround', 'complete', 'enabled'),
				item('cursor-setup', 'Cursor setup', 'active', 'copy values')
			]
		}));
		await tick();

		buttonByText('Setup')?.click();
		await tick();
		buttonByText('Copy local API key')?.click();
		await tick();

		expect(messages).toContainEqual(expect.objectContaining({
			type: 'dashboard.copyCursorSetup',
			copyKind: 'api_key'
		}));
		expect(document.body.textContent).toContain('Copy local API key in progress');
		expect(document.querySelector('button[aria-busy="true"]')?.textContent).toContain('API key');
		expect(buttonByText('Verify public URL')?.disabled).toBe(false);
	});

	it('does not let completion for request A clear request B pending state', async () => {
		const messages: Array<{ requestId?: string; type?: string }> = [];
		await mountDashboard(messages);
		postSetupState(makeSetupState());
		await tick();

		buttonByText('Setup')?.click();
		await tick();
		buttonByText('Start Quick Tunnel')?.click();
		await tick();
		buttonByText('Diagnostics')?.click();
		await tick();
		buttonByText('Run doctor')?.click();
		await tick();

		const quickRequest = messages.find((message) => message.type === 'dashboard.startQuickTunnel')?.requestId;
		expect(quickRequest).toBeTruthy();
		expect(messages).toContainEqual(expect.objectContaining({ type: 'dashboard.runDoctor' }));

		postSetupState(makeSetupState(), quickRequest);
		await tick();

		expect(document.body.textContent).toContain('Run doctor in progress');
		expect(document.body.textContent).not.toContain('Start Quick Tunnel in progress');
	});
});

async function mountDashboard(messages: unknown[]): Promise<void> {
	document.body.innerHTML = '<div id="app"></div>';
	Reflect.set(globalThis, 'acquireVsCodeApi', () => ({
		postMessage: (message: unknown) => messages.push(message)
	}));
	await import('../src/main.js');
}

function postSetupState(state: SetupState, requestId = 'state'): void {
	window.dispatchEvent(new MessageEvent('message', {
		data: { requestId, type: 'extension.setupState', state }
	}));
}

function postDoctorReport(): void {
	const report: DoctorReport = {
		generatedAt: 1,
		checks: [],
		groups: {
			fail: [
				{
					id: 'public-url',
					label: 'Public URL not ready',
					status: 'fail',
					guidance: 'Verify a public URL before copying Cursor setup.',
					details: { route: 'missing' }
				}
			],
			warn: [
				{ id: 'usage-storage', label: 'Usage storage degraded', status: 'warn', guidance: 'Non-blocking warning.' }
			],
			pass: [
				{ id: 'runtime', label: 'Runtime listening', status: 'pass', guidance: 'Local API is reachable.' }
			]
		}
	};
	window.dispatchEvent(new MessageEvent('message', {
		data: { requestId: 'doctor', type: 'extension.doctorReport', report }
	}));
}

function makeSetupState(overrides: Partial<SetupState> = {}): SetupState {
	return {
		generatedAt: 1,
		environmentLabel: 'Current extension host',
		statusBarPreference: 'visible',
		notificationPreference: 'balanced',
		modelWorkaroundDecision: 'decide_later',
		openAiKeyRepair: { decision: 'skipped', capability: 'available' },
		localTargetUrl: 'http://127.0.0.1:50151',
		publicUrl: { url: null, state: 'not_configured', source: null, temporary: false },
		apiTraffic: createEmptyApiTrafficStatus(),
		tunnel: createQuickTunnelStatus('stopped'),
		readiness: { state: 'setup', blockers: ['Public Extension Base URL'], warnings: [] },
		items: [
			item('runtime', 'Local API runtime', 'complete', 'ready'),
			item('codex-auth', 'Codex authentication', 'complete', 'auth ready'),
			item('public-url', 'Public Extension Base URL', 'active', 'verify /ready'),
			item('harness-workaround', 'Harness Routing Workaround', 'active', 'choose model routing'),
			item('cursor-setup', 'Cursor setup', 'blocked', 'copy values after route and model decision')
		],
		...overrides
	};
}

function item(id: string, label: string, status: SetupChecklistItem['status'], guidance: string): SetupChecklistItem {
	return { id, label, status, guidance };
}

function buttonByText(text: string): HTMLButtonElement | null {
	return Array.from(document.querySelectorAll('button'))
		.find((button) => {
			const label = button.textContent?.replace(/\s+/g, ' ').trim();
			return label === text || label === `${text} Later`;
		}) ?? null;
}

function buttonContaining(text: string): HTMLButtonElement | null {
	return Array.from(document.querySelectorAll('button'))
		.find((button) => button.textContent?.replace(/\s+/g, ' ').trim().includes(text)) ?? null;
}

function buttonsContaining(text: string): HTMLButtonElement[] {
	return Array.from(document.querySelectorAll('button'))
		.filter((button) => button.textContent?.replace(/\s+/g, ' ').trim().includes(text));
}
