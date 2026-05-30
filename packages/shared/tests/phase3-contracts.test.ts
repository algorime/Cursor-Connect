import {
	buildStatusBarViewModel,
	buildPublicRouteUrl,
	buildVerifiedExtensionBaseUrl,
	createQuickTunnelStatus,
	groupDoctorChecks,
	redactDoctorReport,
	type DashboardToExtensionMessage,
	type DoctorReport
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('phase 3 shared setup contracts', () => {
	it('builds Cursor-facing /v1 base URLs only from verified HTTPS public URLs', () => {
		expect(buildVerifiedExtensionBaseUrl('https://codex.example.com/')).toBe('https://codex.example.com/v1');
		expect(buildPublicRouteUrl('https://codex.example.com/v1')).toBe('https://codex.example.com');
		expect(buildPublicRouteUrl('https://codex.example.com/base/v1')).toBe('https://codex.example.com/base');
		expect(buildVerifiedExtensionBaseUrl('https://codex.example.com/base/v1')).toBe('https://codex.example.com/base/v1');
		expect(() => buildVerifiedExtensionBaseUrl('http://codex.example.com')).toThrow(/https/i);
	});

	it('redacts doctor report detail values without dropping guidance', () => {
		const report: DoctorReport = {
			generatedAt: 1,
			checks: [
				{
					id: 'local-api-key',
					label: 'Generated local API key',
					status: 'pass',
					guidance: 'Copy the generated key into Cursor when prompted.',
					details: {
						localApiKey: 'secret-key',
						nested: { accessToken: 'nested-secret', safe: 'visible' },
						list: ['Bearer nested-secret', 'visible'],
						safeLabel: 'configured'
					}
				}
			],
			groups: groupDoctorChecks([
				{
					id: 'local-api-key',
					label: 'Generated local API key',
					status: 'pass',
					guidance: 'Copy the generated key into Cursor when prompted.',
					details: {
						localApiKey: 'secret-key',
						nested: { accessToken: 'nested-secret', safe: 'visible' },
						list: ['Bearer nested-secret', 'visible'],
						safeLabel: 'configured'
					}
				}
			])
		};

		const redacted = redactDoctorReport(report);

		expect(redacted.checks[0]?.guidance).toContain('Copy');
		expect(redacted.checks[0]?.details).toEqual({
			localApiKey: '[REDACTED]',
			nested: { accessToken: '[REDACTED]', safe: 'visible' },
			list: ['[REDACTED]', 'visible'],
			safeLabel: 'configured'
		});
	});

	it('derives privacy-first status bar text from setup state', () => {
		expect(buildStatusBarViewModel({ preference: 'hidden', ready: true, tunnelRunning: false })).toEqual({
			visible: false,
			text: 'Codex',
			tooltip: 'Codex status hidden'
		});
		expect(buildStatusBarViewModel({ preference: 'visible', ready: false, tunnelRunning: false })).toMatchObject({
			visible: true,
			text: 'Codex: Setup'
		});
		expect(buildStatusBarViewModel({ preference: 'visible', ready: false, tunnelRunning: false, authReady: false })).toMatchObject({
			text: 'Codex: Auth'
		});
		expect(buildStatusBarViewModel({ preference: 'visible', ready: false, tunnelRunning: false, authReady: true, routeReady: false })).toMatchObject({
			text: 'Codex: Route'
		});
		expect(buildStatusBarViewModel({ preference: 'visible', ready: true, tunnelRunning: true, temporaryRoute: true })).toMatchObject({
			visible: true,
			text: 'Codex: Ready',
			tooltip: expect.stringMatching(/temporary Quick Tunnel/i)
		});
	});

	it('models dashboard bridge messages without exposing secrets by default', () => {
		const message: DashboardToExtensionMessage = {
			type: 'dashboard.getSetupState',
			requestId: 'req-1'
		};

		expect(message).toEqual({ type: 'dashboard.getSetupState', requestId: 'req-1' });
	});

	it('keeps Quick Tunnel temporary and streaming-unverified by default', () => {
		expect(createQuickTunnelStatus('running', 'https://example.trycloudflare.com')).toMatchObject({
			kind: 'quick_tunnel',
			state: 'running',
			temporary: true,
			streamingUnsupportedOrUnverified: true,
			url: 'https://example.trycloudflare.com'
		});
	});
});
