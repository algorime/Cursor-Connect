import { describe, expect, it } from 'vitest';

import { detectExtensionHostEnvironment } from '../src/setup/environment.js';

describe('extension host environment labels', () => {
	it('identifies local and common remote extension hosts', () => {
		expect(detectExtensionHostEnvironment(undefined)).toBe('Local extension host');
		expect(detectExtensionHostEnvironment('ssh-remote')).toBe('Remote SSH extension host');
		expect(detectExtensionHostEnvironment('wsl')).toBe('WSL extension host');
		expect(detectExtensionHostEnvironment('dev-container')).toBe('Dev Container extension host');
		expect(detectExtensionHostEnvironment('codespaces')).toBe('Codespaces extension host');
	});
});
