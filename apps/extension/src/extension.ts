import * as path from 'node:path';

import * as vscode from 'vscode';

import { SafeRuntimeLogger } from './logger/safe-logger.js';
import { SecretStorageCredentialStore } from './runtime/credentials.js';
import { PortManager } from './runtime/port-manager.js';
import { JsonFilePortStore } from './runtime/port-store.js';
import { RuntimeSupervisor } from './runtime/supervisor.js';

let supervisor: RuntimeSupervisor | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const logger = new SafeRuntimeLogger();
	const portStore = new JsonFilePortStore(
		path.join(context.globalStorageUri.fsPath, 'runtime', 'port.json')
	);
	const portManager = new PortManager({ store: portStore });
	const credentials = new SecretStorageCredentialStore(context.secrets);

	supervisor = new RuntimeSupervisor({
		extensionPath: context.extensionPath,
		devMode: context.extensionMode === vscode.ExtensionMode.Development,
		portManager,
		credentials,
		logger
	});

	context.subscriptions.push(
		vscode.commands.registerCommand('codexAuthExt.showRuntimeStatus', () => {
			const status = supervisor?.getStatus().snapshot;

			if (!status) {
				void vscode.window.showInformationMessage('Runtime not initialized');

				return;
			}

			void vscode.window.showInformationMessage(
				`Runtime: ${status.phase}${status.localTargetUrl ? ` @ ${status.localTargetUrl}` : ''}`
			);
		}),
		vscode.commands.registerCommand('codexAuthExt.restartRuntime', async () => {
			if (!supervisor) {
				return;
			}

			const snapshot = await supervisor.restart();
			void vscode.window.showInformationMessage(`Runtime restarted: ${snapshot.phase}`);
		}),
		{
			dispose: () => {
				void supervisor?.stop();
			}
		}
	);

	const snapshot = await supervisor.start();

	if (snapshot.phase !== 'ready') {
		logger.log({
			component: 'extension',
			eventType: 'runtime.starting',
			severity: 'warn',
			timestamp: Date.now(),
			category: snapshot.failureCategory,
			message: snapshot.message ?? `runtime entered ${snapshot.phase}`
		});
	}
}

export async function deactivate(): Promise<void> {
	await supervisor?.stop();
	supervisor = null;
}

export function getRuntimeSupervisorForTests(): RuntimeSupervisor | null {
	return supervisor;
}
