import fs from 'node:fs';
import path from 'node:path';

export const DASHBOARD_ASSET_DIR = 'dashboard';

interface UriLike {
	fsPath: string;
	scheme?: string;
	toString?: () => string;
}

interface WebviewLike {
	cspSource: string;
	asWebviewUri(uri: UriLike): { toString(): string };
}

export interface DashboardWebviewHtmlOptions {
	extensionPath: string;
	extensionUri: UriLike;
	webview: WebviewLike;
	nonce?: string;
	toResourceUri?: (relativePath: string) => UriLike;
}

interface ViteManifestEntry {
	file: string;
	css?: string[];
}

export function buildDashboardWebviewHtml(options: DashboardWebviewHtmlOptions): string {
	const nonce = options.nonce ?? createNonce();
	const entry = readDashboardEntry(options.extensionPath);
	const scriptUri = webviewUri(options, entry.file);
	const styles = (entry.css ?? []).map((file) => {
		const href = webviewUri(options, file);
		return `<link rel="stylesheet" href="${escapeHtml(href)}">`;
	});
	const csp = [
		"default-src 'none'",
		`img-src ${options.webview.cspSource} https: data:`,
		`font-src ${options.webview.cspSource}`,
		`style-src ${options.webview.cspSource}`,
		`script-src 'nonce-${nonce}' ${options.webview.cspSource}`,
		"connect-src 'none'"
	].join('; ');

	return [
		'<!doctype html>',
		'<html lang="en">',
		'<head>',
		'<meta charset="UTF-8">',
		'<meta name="viewport" content="width=device-width, initial-scale=1.0">',
		`<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`,
		'<title>Codex Auth Dashboard</title>',
		...styles,
		'</head>',
		'<body>',
		'<div id="app"></div>',
		`<script type="module" nonce="${nonce}" src="${escapeHtml(scriptUri)}"></script>`,
		'</body>',
		'</html>'
	].join('\n');
}

function readDashboardEntry(extensionPath: string): ViteManifestEntry {
	const manifestPath = path.join(extensionPath, DASHBOARD_ASSET_DIR, '.vite', 'manifest.json');
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, ViteManifestEntry>;
	const entry = manifest['src/main.ts'];

	if (!entry?.file) {
		throw new Error('Dashboard Vite manifest is missing src/main.ts');
	}

	return entry;
}

function webviewUri(options: DashboardWebviewHtmlOptions, relativePath: string): string {
	const resource = options.toResourceUri
		? options.toResourceUri(relativePath)
		: {
				...options.extensionUri,
				fsPath: path.join(options.extensionUri.fsPath, DASHBOARD_ASSET_DIR, relativePath)
			};

	return options.webview.asWebviewUri(resource).toString();
}

function createNonce(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Buffer.from(bytes).toString('base64url');
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}
