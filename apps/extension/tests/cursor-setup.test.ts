import { describe, expect, it } from 'vitest';

import { buildCursorSetupDetails, serializeCursorSetup } from '../src/runtime/cursor-setup.js';

describe('cursor setup details', () => {
	it('uses the editor-external URL as the Cursor-facing base URL when available', () => {
		const setup = buildCursorSetupDetails({
			localTargetUrl: 'http://127.0.0.1:50151',
			extensionBaseUrl: 'https://example.trycloudflare.com/',
			apiKey: 'local-key'
		});

		expect(setup).toMatchObject({
			baseUrl: 'https://example.trycloudflare.com/v1',
			apiKey: 'local-key',
			localTargetUrl: 'http://127.0.0.1:50151',
			routeKind: 'user_provided',
			temporaryRoute: false,
			models: ['gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4'],
			publicUrlRequired: false
		});
	});

	it('serializes setup without internal control fields', () => {
		const serialized = serializeCursorSetup({
			baseUrl: 'https://example.trycloudflare.com/v1',
			apiKey: 'local-key',
			localTargetUrl: 'http://127.0.0.1:50151',
			routeKind: 'quick_tunnel',
			temporaryRoute: true,
			routeWarning: 'Temporary Quick Tunnel route: this URL can change or stop. If it changes, restart Quick Tunnel and update Cursor settings.',
			models: ['gpt-5.4'],
			publicUrlRequired: false,
			instructions: 'Use gpt-5.4 and do not use direct gpt-5.5 until verified.',
			manualConfirmationRequired: true,
			rotationWarning: null
		});

		expect(serialized).toContain('"baseUrl"');
		expect(serialized).toContain('"apiKey"');
		expect(serialized).toContain('"localTargetUrl"');
		expect(serialized).toContain('"temporaryRoute"');
		expect(serialized).toContain('Temporary Quick Tunnel route');
		expect(serialized).toContain('"publicUrlRequired"');
		expect(serialized).toContain('direct gpt-5.5');
		expect(serialized).not.toContain('internalControl');
	});

	it('includes Harness Routing Workaround language and rotation warning when requested', () => {
		const setup = buildCursorSetupDetails({
			localTargetUrl: 'http://127.0.0.1:50151',
			extensionBaseUrl: 'https://codex.example.com',
			apiKey: 'local-key',
			manualConfirmationRequired: true,
			apiKeyRotated: true
		});

		expect(setup.instructions).toContain('gpt-5.4');
		expect(setup.instructions).toContain('gpt-5.5');
		expect(setup.instructions).toContain('custom model IDs');
		expect(setup.rotationWarning).toMatch(/old key/i);
		expect(setup.manualConfirmationRequired).toBe(true);
	});

	it('does not treat VS Code localhost forwarding as a public Cursor backend URL', () => {
		const setup = buildCursorSetupDetails({
			localTargetUrl: 'http://127.0.0.1:50151',
			apiKey: 'local-key'
		});

		expect(setup.baseUrl).toBeNull();
		expect(setup.localTargetUrl).toBe('http://127.0.0.1:50151');
	});
});
