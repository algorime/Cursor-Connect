import { describe, expect, it } from 'vitest';

import {
	copyCursorSetup,
	markManualConfirmation,
	openCursorSettings,
	recheckAuth,
	importCodexAuth,
	restartQuickTunnel,
	rotateLocalApiKey,
	runDoctor,
	setOpenAiKeyRepairDecision,
	setNotificationPreference,
	setModelWorkaroundDecision,
	setStatusBarPreference,
	signInCodex,
	startQuickTunnel,
	stopQuickTunnel,
	verifyPublicUrl,
	type VsCodeWebviewApi
} from '../src/bridge.js';

describe('dashboard bridge action messages', () => {
	it('sends Phase 3 setup actions through the typed bridge', () => {
		const messages: unknown[] = [];
		const vscode: VsCodeWebviewApi = { postMessage: (message) => messages.push(message) };

		signInCodex(vscode, 'sign-in');
		importCodexAuth(vscode, 'import-auth');
		recheckAuth(vscode, 'recheck-auth');
		verifyPublicUrl(vscode, 'https://codex.example.com', 'verify');
		copyCursorSetup(vscode, 'full', 'copy-full');
		copyCursorSetup(vscode, 'base_url', 'copy-base');
		copyCursorSetup(vscode, 'api_key', 'copy-key');
		copyCursorSetup(vscode, 'models', 'copy-models');
		markManualConfirmation(vscode, true, 'confirm');
		runDoctor(vscode, 'doctor');
		rotateLocalApiKey(vscode, 'rotate');
		setOpenAiKeyRepairDecision(vscode, 'enabled', 'openai-repair');
		setStatusBarPreference(vscode, 'hidden', 'status');
		setNotificationPreference(vscode, 'verbose', 'notifications');
		setModelWorkaroundDecision(vscode, 'skipped', 'workaround');
		openCursorSettings(vscode, 'OpenAI API Key', 'settings');
		startQuickTunnel(vscode, 'start-tunnel');
		stopQuickTunnel(vscode, 'stop-tunnel');
		restartQuickTunnel(vscode, 'restart-tunnel');

		expect(messages).toEqual([
			{ requestId: 'sign-in', type: 'dashboard.signInCodex' },
			{ requestId: 'import-auth', type: 'dashboard.importCodexAuth' },
			{ requestId: 'recheck-auth', type: 'dashboard.recheckAuth' },
			{ requestId: 'verify', type: 'dashboard.verifyPublicUrl', url: 'https://codex.example.com' },
			{ requestId: 'copy-full', type: 'dashboard.copyCursorSetup', copyKind: 'full' },
			{ requestId: 'copy-base', type: 'dashboard.copyCursorSetup', copyKind: 'base_url' },
			{ requestId: 'copy-key', type: 'dashboard.copyCursorSetup', copyKind: 'api_key' },
			{ requestId: 'copy-models', type: 'dashboard.copyCursorSetup', copyKind: 'models' },
			{ requestId: 'confirm', type: 'dashboard.markManualConfirmation', confirmed: true },
			{ requestId: 'doctor', type: 'dashboard.runDoctor' },
			{ requestId: 'rotate', type: 'dashboard.rotateLocalApiKey' },
			{ requestId: 'openai-repair', type: 'dashboard.setOpenAiKeyRepairDecision', decision: 'enabled' },
			{ requestId: 'status', type: 'dashboard.setStatusBarPreference', preference: 'hidden' },
			{ requestId: 'notifications', type: 'dashboard.setNotificationPreference', preference: 'verbose' },
			{ requestId: 'workaround', type: 'dashboard.setModelWorkaroundDecision', decision: 'skipped' },
			{ requestId: 'settings', type: 'dashboard.openCursorSettings', query: 'OpenAI API Key' },
			{ requestId: 'start-tunnel', type: 'dashboard.startQuickTunnel' },
			{ requestId: 'stop-tunnel', type: 'dashboard.stopQuickTunnel' },
			{ requestId: 'restart-tunnel', type: 'dashboard.restartQuickTunnel' }
		]);
	});
});
