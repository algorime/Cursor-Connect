import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildDashboardWebviewHtml } from '../src/dashboard/webview-html.js';

describe('dashboard webview packaging', () => {
	it('builds CSP-locked webview HTML from the staged Vite manifest', () => {
		const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-dashboard-'));
		const manifestDir = path.join(extensionPath, 'dashboard/.vite');
		fs.mkdirSync(manifestDir, { recursive: true });
		fs.writeFileSync(
			path.join(manifestDir, 'manifest.json'),
			JSON.stringify({
				'src/main.ts': {
					file: 'assets/dashboard.js',
					css: ['assets/dashboard.css']
				}
			})
		);

		const html = buildDashboardWebviewHtml({
			extensionPath,
			extensionUri: { fsPath: extensionPath, scheme: 'file' },
			nonce: 'fixed-nonce',
			webview: {
				cspSource: 'vscode-resource:',
				asWebviewUri: (uri: { fsPath: string }) => ({ toString: () => `webview://${uri.fsPath}` })
			}
		});

		expect(html).toContain('<div id="app"></div>');
		expect(html).toContain("default-src 'none'");
		expect(html).toContain("script-src 'nonce-fixed-nonce' vscode-resource:");
		expect(html).toContain("connect-src 'none'");
		expect(html).not.toContain('unsafe-inline');
		expect(html).toContain('webview://');
		expect(html).toContain('assets/dashboard.js');
		expect(html).toContain('assets/dashboard.css');
	});
});
