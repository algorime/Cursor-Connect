import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('dashboard package manifest', () => {
	it('contributes an open dashboard command and keeps staged assets packageable', () => {
		const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8')) as {
			contributes?: { commands?: Array<{ command: string; title: string }> };
		};

		expect(manifest.contributes?.commands).toContainEqual({
			command: 'codexAuthExt.openDashboard',
			title: 'Codex Auth: Open Dashboard'
		});
		expect(manifest.contributes?.commands).toContainEqual({
			command: 'codexAuthExt.doctorCheckSetup',
			title: 'Codex Auth: Doctor Check Setup'
		});
		expect(manifest.contributes?.commands).toContainEqual({
			command: 'codexAuthExt.copyExtensionBaseUrl',
			title: 'Codex Auth: Copy Extension Base URL'
		});
		expect(manifest.contributes?.commands).toContainEqual({
			command: 'codexAuthExt.copyLocalApiKey',
			title: 'Codex Auth: Copy Local API Key'
		});
		expect(manifest.contributes?.commands).toContainEqual({
			command: 'codexAuthExt.restartTunnel',
			title: 'Codex Auth: Restart Quick Tunnel'
		});
		expect(fs.readFileSync(path.join(extensionRoot, '.vscodeignore'), 'utf8')).not.toMatch(/^dashboard\//m);
	});
});
