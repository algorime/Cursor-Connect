import * as path from 'node:path';

import * as vscode from 'vscode';

import {
	CodexAuthError,
	CodexAuthManager,
	OpenAICodexOAuthClient,
	type SecretStore,
} from './codex-auth/codex-auth-manager.js';
import { waitForOAuthCallback } from './codex-auth/oauth-callback-server.js';
import { SafeRuntimeLogger } from './logger/safe-logger.js';
import { SecretStorageCredentialStore } from './runtime/credentials.js';
import { PortManager } from './runtime/port-manager.js';
import { JsonFilePortStore } from './runtime/port-store.js';
import { RuntimeSupervisor } from './runtime/supervisor.js';
import { createVsCodeStateStore, ModelRoutingSettingsStore } from './settings/model-routing.js';

let supervisor: RuntimeSupervisor | null = null;
let codexAuth: CodexAuthManager | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const logger = new SafeRuntimeLogger();
	const portStore = new JsonFilePortStore(
		path.join(context.globalStorageUri.fsPath, 'runtime', 'port.json')
	);
	const portManager = new PortManager({ store: portStore });
	const credentials = new SecretStorageCredentialStore(context.secrets);
	const routingSettings = new ModelRoutingSettingsStore(createVsCodeStateStore(context.globalState));
	codexAuth = new CodexAuthManager(toSecretStore(context.secrets), new OpenAICodexOAuthClient());

	supervisor = new RuntimeSupervisor({
		extensionPath: context.extensionPath,
		devMode: context.extensionMode === vscode.ExtensionMode.Development,
		portManager,
		credentials,
		logger,
		getCodexAuthState: async () => {
			const status = await codexAuth?.getStatus();
			return status?.state ?? 'not_configured';
		},
		authHandoffResponder: async (request) => {
			if (!codexAuth) {
				return {
					ok: false,
					code: 'auth_required',
					message: 'Codex auth is required'
				};
			}

			try {
				return {
					ok: true,
					context: await codexAuth.getRequestScopedAuth({
						forceRefresh: request.reason === 'forced_refresh_after_401'
					})
				};
			} catch (error) {
				return authErrorToHandoff(error);
			}
		},
		modelRoutingWorkaroundEnabled: () => routingSettings.getGpt54ToGpt55WorkaroundEnabled()
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
		vscode.commands.registerCommand('codexAuthExt.signInCodex', async () => {
			if (!codexAuth) {
				return;
			}

			let callbackServer: Awaited<ReturnType<typeof waitForOAuthCallback>> | null = null;
			try {
				const state = crypto.randomUUID();
				callbackServer = await waitForOAuthCallback({ state });
				const started = await codexAuth.startOAuth(callbackServer.redirectUri, state);
				await vscode.env.openExternal(vscode.Uri.parse(started.url));
				const callback = await callbackServer.waitForCallback;
				await codexAuth.completeOAuth(callback.code, started.codeVerifier, callbackServer.redirectUri);
				const snapshot = await supervisor?.restart();
				void vscode.window.showInformationMessage(
					`Codex sign-in complete${snapshot ? `; runtime ${snapshot.phase}` : ''}`
				);
			} catch (error) {
				void vscode.window.showErrorMessage(readErrorMessage(error));
			} finally {
				await callbackServer?.dispose();
			}
		}),
		vscode.commands.registerCommand('codexAuthExt.importCodexAuthJson', async () => {
			if (!codexAuth) {
				return;
			}

			try {
				await codexAuth.importAuthJson();
				const snapshot = await supervisor?.restart();
				void vscode.window.showInformationMessage(
					`Codex auth imported${snapshot ? `; runtime ${snapshot.phase}` : ''}`
				);
			} catch (error) {
				void vscode.window.showErrorMessage(readErrorMessage(error));
			}
		}),
		vscode.commands.registerCommand('codexAuthExt.logoutCodex', async () => {
			await codexAuth?.logout();
			const snapshot = await supervisor?.restart();
			void vscode.window.showInformationMessage(
				`Codex auth removed${snapshot ? `; runtime ${snapshot.phase}` : ''}`
			);
		}),
		vscode.commands.registerCommand('codexAuthExt.enableGpt55Workaround', async () => {
			await routingSettings.setGpt54ToGpt55WorkaroundEnabled(true);
			const snapshot = await supervisor?.restart();
			void vscode.window.showInformationMessage(
				`Harness Routing Workaround enabled${snapshot ? `; runtime ${snapshot.phase}` : ''}`
			);
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
	codexAuth = null;
}

export function getRuntimeSupervisorForTests(): RuntimeSupervisor | null {
	return supervisor;
}

function authErrorToHandoff(error: unknown) {
	if (error instanceof CodexAuthError && error.code === 'auth_refresh_failed') {
		return {
			ok: false as const,
			code: 'auth_refresh_failed' as const,
			message: 'Codex auth refresh failed'
		};
	}

	return {
		ok: false as const,
		code: 'auth_required' as const,
		message: 'Codex auth is required'
	};
}

function readErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Codex auth operation failed';
}

function toSecretStore(secrets: vscode.SecretStorage): SecretStore {
	return {
		async get(key: string): Promise<string | undefined> {
			return secrets.get(key);
		},
		async store(key: string, value: string): Promise<void> {
			await secrets.store(key, value);
		},
		async delete(key: string): Promise<void> {
			await secrets.delete(key);
		}
	};
}
