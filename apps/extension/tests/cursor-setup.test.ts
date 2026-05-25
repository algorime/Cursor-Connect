import { describe, expect, it } from 'vitest';

import { buildCursorSetupDetails, serializeCursorSetup } from '../src/runtime/cursor-setup.js';

describe('cursor setup details', () => {
	it('uses the editor-external URL as the Cursor-facing base URL when available', () => {
		const setup = buildCursorSetupDetails({
			localTargetUrl: 'http://127.0.0.1:50151',
			extensionBaseUrl: 'https://example.trycloudflare.com/',
			apiKey: 'local-key'
		});

		expect(setup).toEqual({
			baseUrl: 'https://example.trycloudflare.com/v1',
			apiKey: 'local-key',
			localTargetUrl: 'http://127.0.0.1:50151',
			models: ['gpt-5.4', 'gpt-5.4-mini'],
			publicUrlRequired: false
		});
	});

	it('serializes setup without internal control fields', () => {
		const serialized = serializeCursorSetup({
			baseUrl: 'https://example.trycloudflare.com/v1',
			apiKey: 'local-key',
			localTargetUrl: 'http://127.0.0.1:50151',
			models: ['gpt-5.4'],
			publicUrlRequired: false
		});

		expect(serialized).toContain('"baseUrl"');
		expect(serialized).toContain('"apiKey"');
		expect(serialized).toContain('"localTargetUrl"');
		expect(serialized).toContain('"publicUrlRequired"');
		expect(serialized).not.toContain('internalControl');
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
