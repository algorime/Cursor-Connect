import * as vscode from 'vscode';
import type { DashboardToExtensionMessage } from '@codex-auth-ext/shared';

import type { SetupCoordinator } from '../setup/setup-coordinator.js';
import {
	SETUP_COPY_BUSY_MESSAGE,
	SETUP_MUTATION_BUSY_MESSAGE,
	SetupMutationGuard,
	isSetupAffectingDashboardMessage,
	isSetupCopyDashboardMessage
} from './setup-mutation-guard.js';

export function attachDashboardBridge(
	panel: vscode.WebviewPanel,
	coordinator: SetupCoordinator,
	clipboard?: { writeText(value: string): Thenable<void> | Promise<void> },
	afterSetupStateChange?: () => Promise<void> | void,
	setupMutationGuard: SetupMutationGuard = new SetupMutationGuard()
): vscode.Disposable {
	return panel.webview.onDidReceiveMessage((message: DashboardToExtensionMessage) => {
		void handleDashboardMessage(panel.webview, coordinator, message, clipboard, afterSetupStateChange, setupMutationGuard);
	});
}

async function handleDashboardMessage(
	webview: vscode.Webview,
	coordinator: SetupCoordinator,
	message: DashboardToExtensionMessage,
	clipboard?: { writeText(value: string): Thenable<void> | Promise<void> },
	afterSetupStateChange?: () => Promise<void> | void,
	setupMutationGuard: SetupMutationGuard = new SetupMutationGuard()
): Promise<void> {
	const requestId = message.requestId;
	let guardRelease: { release(): void } | null = null;
	try {
		if (isSetupCopyDashboardMessage(message) && setupMutationGuard.isActive()) {
			await webview.postMessage({
				requestId,
				type: 'extension.error',
				message: SETUP_COPY_BUSY_MESSAGE
			});
			return;
		}

		if (isSetupAffectingDashboardMessage(message)) {
			guardRelease = setupMutationGuard.tryBegin(requestId);
			if (!guardRelease) {
				await webview.postMessage({
					requestId,
					type: 'extension.error',
					message: SETUP_MUTATION_BUSY_MESSAGE
				});
				return;
			}
		}
		if (message.type === 'dashboard.getSetupState') {
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}


		if (message.type === 'dashboard.signInCodex') {
			await vscode.commands.executeCommand('codexAuthExt.signInCodex');
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.actionComplete',
				message: 'Codex sign-in finished or was handed off to the browser. Setup state refreshed.'
			});
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}

		if (message.type === 'dashboard.importCodexAuth') {
			await vscode.commands.executeCommand('codexAuthExt.importCodexAuthJson');
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.actionComplete',
				message: 'Codex auth import finished. Setup state refreshed.'
			});
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}

		if (message.type === 'dashboard.recheckAuth') {
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}

		if (message.type === 'dashboard.runDoctor') {
			await webview.postMessage({
				requestId,
				type: 'extension.doctorReport',
				report: await coordinator.runDoctor()
			});
			return;
		}

		if (message.type === 'dashboard.verifyPublicUrl') {
			await coordinator.verifyPublicUrl(message.url);
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}

		if (message.type === 'dashboard.markManualConfirmation') {
			await coordinator.markManualConfirmation(message.confirmed);
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}

		if (message.type === 'dashboard.copyCursorSetup') {
			await clipboard?.writeText(await coordinator.copyCursorSetupValue(message.copyKind));
			await webview.postMessage({
				requestId,
				type: 'extension.actionComplete',
				message: `Copied Cursor setup ${message.copyKind}.`
			});
			return;
		}

		if (message.type === 'dashboard.rotateLocalApiKey') {
			const result = await coordinator.rotateLocalApiKey();
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.actionComplete',
				message: result
			});
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}

		if (message.type === 'dashboard.setOpenAiKeyRepairDecision') {
			await webview.postMessage({
				requestId,
				type: 'extension.doctorReport',
				report: await coordinator.setOpenAiKeyRepairDecision(message.decision)
			});
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}

		if (message.type === 'dashboard.setStatusBarPreference') {
			const state = await coordinator.setStatusBarPreference(message.preference);
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state
			});
			return;
		}

		if (message.type === 'dashboard.setNotificationPreference') {
			const state = await coordinator.setNotificationPreference(message.preference);
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state
			});
			return;
		}

		if (message.type === 'dashboard.openCursorSettings') {
			await vscode.commands.executeCommand('workbench.action.openSettings', message.query);
			await webview.postMessage({
				requestId,
				type: 'extension.actionComplete',
				message: 'Opened Cursor settings. Paste copied setup values manually; no private settings were edited.'
			});
			return;
		}

		if (message.type === 'dashboard.startQuickTunnel') {
			const status = await coordinator.startQuickTunnel();
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.quickTunnelStatus',
				status
			});
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}

		if (message.type === 'dashboard.stopQuickTunnel') {
			const status = await coordinator.stopQuickTunnel();
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.quickTunnelStatus',
				status
			});
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}

		if (message.type === 'dashboard.restartQuickTunnel') {
			const status = await coordinator.restartQuickTunnel();
			await afterSetupStateChange?.();
			await webview.postMessage({
				requestId,
				type: 'extension.quickTunnelStatus',
				status
			});
			await webview.postMessage({
				requestId,
				type: 'extension.setupState',
				state: await coordinator.getSetupState()
			});
			return;
		}

		await webview.postMessage({
			requestId,
			type: 'extension.error',
			message: 'This dashboard action is not available in the current setup surface yet.'
		});
	} catch (error) {
		await webview.postMessage({
			requestId,
			type: 'extension.error',
			message: error instanceof Error ? error.message : 'Dashboard action failed'
		});
	} finally {
		guardRelease?.release();
	}
}
