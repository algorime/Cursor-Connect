import { createEmptyApiTrafficStatus, createQuickTunnelStatus } from '@codex-auth-ext/shared';
import { describe, expect, it } from 'vitest';

import { buildDoctorReport, doctorReportToMarkdown } from '../src/setup/doctor.js';
import { buildExtensionStatusBarViewModel } from '../src/setup/status-bar.js';

describe('doctor and status surfaces', () => {
	it('builds a redacted read-only doctor report with grouped guidance', () => {
		const report = buildDoctorReport({
			runtime: { phase: 'ready', failureCategory: 'none', localTargetUrl: 'http://127.0.0.1:50000', port: 50000, message: null, updatedAt: 1, runtimeId: 'runtime-1' },
			publicUrl: { url: 'https://codex.example.com', state: 'authenticated_ready', source: 'user_provided', temporary: false, runtimeId: 'runtime-1' },
			codexAuthState: 'authenticated',
			apiTraffic: { lastCursorFacingRequest: { method: 'GET', path: '/v1/models', at: 2 } },
			tunnel: createQuickTunnelStatus('running', 'https://abc.trycloudflare.com'),
			openAiKeyRepair: { decision: 'decide_later', capability: 'unavailable', reason: 'not_found' },
			statusPreference: 'visible',
			notificationPreference: 'verbose',
			cursorSetup: { manualConfirmed: true, confirmedAt: 1 },
			modelWorkaround: 'decide_later',
			localApiKeyPresent: true,
			cloudflaredProvision: { status: 'integrity_failed', message: 'cloudflared checksum mismatch' },
			usageStorageState: 'ready',
			environmentLabel: 'Remote SSH host',
			secrets: { localApiKey: 'secret-key' }
		});

		expect(JSON.stringify(report)).not.toContain('secret-key');
		expect(report.checks.map((check) => check.id)).toContain('quick-tunnel');
		expect(report.checks.map((check) => check.id)).toContain('environment');
		expect(report.checks.map((check) => check.id)).toContain('public-url-health');
		expect(report.checks.map((check) => check.id)).toContain('public-url-ready');
		expect(report.checks.map((check) => check.id)).toContain('local-api-key');
		expect(report.checks.map((check) => check.id)).toContain('cursor-setup-confirmation');
		expect(report.checks.map((check) => check.id)).toContain('model-compatibility-fallback');
		expect(report.checks.map((check) => check.id)).toContain('notification-preference');
		expect(report.checks.find((check) => check.id === 'cloudflared-provisioning')).toMatchObject({ status: 'warn' });
		expect(report.checks.find((check) => check.id === 'openai-key-repair')).toMatchObject({ status: 'pass' });
		expect(report.groups.warn.map((check) => check.id)).toContain('quick-tunnel');
		expect(doctorReportToMarkdown(report)).toContain('Quick Tunnel');
		expect(doctorReportToMarkdown(report)).toContain('## WARN');
	});

	it('warns for non-loopback runtime binding, stale Cursor setup, and optional repair decisions without blocking normal proxying', () => {
		const report = buildDoctorReport({
			runtime: { phase: 'ready', failureCategory: 'none', localTargetUrl: 'http://0.0.0.0:50000', port: 50000, message: null, updatedAt: 1, runtimeId: 'runtime-1' },
			publicUrl: { url: 'https://codex.example.com', state: 'authenticated_ready', source: 'user_provided', temporary: false, runtimeId: 'runtime-1' },
			codexAuthState: 'authenticated',
			apiTraffic: createEmptyApiTrafficStatus(),
			cursorSetup: { manualConfirmed: true, confirmedAt: 1, staleReason: 'Route changed; confirm Cursor setup again.' },
			modelWorkaround: 'decide_later',
			tunnel: createQuickTunnelStatus('not_started'),
			openAiKeyRepair: { decision: 'decide_later', capability: 'available' },
			statusPreference: 'visible',
			notificationPreference: 'balanced',
			cloudflaredProvision: null,
			usageStorageState: 'ready',
			environmentLabel: 'Remote SSH host',
			localApiKeyPresent: true
		});

		expect(report.checks.find((check) => check.id === 'environment')).toMatchObject({ status: 'warn' });
		expect(report.checks.find((check) => check.id === 'cursor-setup-confirmation')).toMatchObject({
			status: 'warn',
			guidance: 'Route changed; confirm Cursor setup again.'
		});
		expect(report.checks.find((check) => check.id === 'openai-key-repair')).toMatchObject({
			status: 'warn',
			guidance: expect.stringMatching(/optional/i)
		});
		expect(report.checks.find((check) => check.id === 'model-compatibility-fallback')).toMatchObject({
			status: 'pass',
			guidance: expect.stringMatching(/does not block Ready/i)
		});
	});

	it('derives privacy-first status bar states', () => {
		expect(buildExtensionStatusBarViewModel({ preference: 'visible', setupReady: false, tunnelRunning: false })).toMatchObject({ text: 'Codex: Setup' });
		expect(buildExtensionStatusBarViewModel({ preference: 'visible', setupReady: false, tunnelRunning: false, authReady: false })).toMatchObject({ text: 'Codex: Auth' });
		expect(buildExtensionStatusBarViewModel({ preference: 'visible', setupReady: false, tunnelRunning: false, authReady: true, routeReady: false })).toMatchObject({ text: 'Codex: Route' });
		expect(buildExtensionStatusBarViewModel({ preference: 'visible', setupReady: false, tunnelRunning: false, authReady: true, routeStale: true })).toMatchObject({ text: 'Codex: Route' });
		expect(buildExtensionStatusBarViewModel({ preference: 'visible', setupReady: true, tunnelRunning: true, temporaryRoute: true })).toMatchObject({
			text: 'Codex: Ready',
			tooltip: expect.stringMatching(/temporary Quick Tunnel/i)
		});
		expect(buildExtensionStatusBarViewModel({ preference: 'hidden', setupReady: true, tunnelRunning: false })).toMatchObject({ visible: false });
	});
});
