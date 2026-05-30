import * as path from 'node:path';
import { spawn } from 'node:child_process';

import * as vscode from 'vscode';
import type { ModelWorkaroundDecision } from '@codex-auth-ext/shared';

import {
	CodexAuthError,
	CodexAuthManager,
	OpenAICodexOAuthClient,
	type SecretStore,
} from './codex-auth/codex-auth-manager.js';
import { prepareOAuthCallbackForBrowser } from './codex-auth/oauth-browser-callback.js';
import { waitForOAuthCallback } from './codex-auth/oauth-callback-server.js';
import { attachDashboardBridge } from './dashboard/dashboard-panel.js';
import { assertSetupCopyAllowed, runGuardedSetupMutation, SetupMutationGuard } from './dashboard/setup-mutation-guard.js';
import { buildDashboardWebviewHtml } from './dashboard/webview-html.js';
import { SafeRuntimeLogger } from './logger/safe-logger.js';
import { SecretStorageCredentialStore } from './runtime/credentials.js';
import { PortManager } from './runtime/port-manager.js';
import { JsonFilePortStore } from './runtime/port-store.js';
import { RuntimeSupervisor } from './runtime/supervisor.js';
import { createVsCodeStateStore, ModelRoutingSettingsStore } from './settings/model-routing.js';
import { CloudflaredProvisioner } from './setup/cloudflared-provisioner.js';
import type { ProvisionResult } from './setup/cloudflared-provisioner.js';
import { detectExtensionHostEnvironment } from './setup/environment.js';
import { OpenAiKeyRepairController } from './setup/openai-key-repair.js';
import { PublicUrlManager } from './setup/public-url-manager.js';
import { QuickTunnelManager, type TunnelProcess } from './setup/quick-tunnel-manager.js';
import { SetupCoordinator } from './setup/setup-coordinator.js';

let supervisor: RuntimeSupervisor | null = null;
let codexAuth: CodexAuthManager | null = null;
let activeQuickTunnel: QuickTunnelManager | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const logger = new SafeRuntimeLogger();
	const portStore = new JsonFilePortStore(
		path.join(context.globalStorageUri.fsPath, 'runtime', 'port.json')
	);
	const portManager = new PortManager({ store: portStore });
	const credentials = new SecretStorageCredentialStore(context.secrets);
	const stateStore = createVsCodeStateStore(context.globalState);
	const routingSettings = new ModelRoutingSettingsStore(stateStore);
	codexAuth = new CodexAuthManager(toSecretStore(context.secrets), new OpenAICodexOAuthClient());
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBar.command = 'codexAuthExt.openDashboard';
	statusBar.text = 'Codex: Setup';
	statusBar.tooltip = 'Open Codex Auth dashboard';
	statusBar.show();

	supervisor = new RuntimeSupervisor({
		extensionPath: context.extensionPath,
		devMode: context.extensionMode === vscode.ExtensionMode.Development,
		usageDbPath: path.join(context.globalStorageUri.fsPath, 'usage', 'usage.sqlite'),
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
	const publicUrl = new PublicUrlManager({
		state: stateStore,
		getLocalApiKey: () => credentials.getLocalApiKey(),
		getExpectedRuntimeId: () => supervisor?.getRuntimeId()
	});
	let cloudflaredBinaryPath: string | null = null;
	let lastCloudflaredProvisionResult: ProvisionResult | null = null;
	const provisioner = new CloudflaredProvisioner({
		cacheDir: path.join(context.globalStorageUri.fsPath, 'cloudflared')
	});
	const dashboardWebviews = new Set<vscode.Webview>();
	let updateStatusBar: () => Promise<void> = async () => undefined;
	let activeSetupCoordinator: SetupCoordinator | null = null;
	const quickTunnel = new QuickTunnelManager({
		spawn: (args) => spawnTunnelProcess(cloudflaredBinaryPath, args),
		onStatusChange: () => {
			void (async () => {
				await updateStatusBar();
				if (activeSetupCoordinator) {
					await broadcastSetupState(dashboardWebviews, activeSetupCoordinator);
				}
			})();
		}
	});
	activeQuickTunnel = quickTunnel;
	const setupCoordinator = new SetupCoordinator({
		state: stateStore,
		credentials,
		publicUrl,
		quickTunnel,
		openAiKeyRepair: new OpenAiKeyRepairController({ state: stateStore }),
		getRuntimeSnapshot: () => supervisor?.getStatus().snapshot ?? {
			phase: 'not_started',
			failureCategory: 'none',
			localTargetUrl: null,
			port: null,
			message: null,
			updatedAt: Date.now()
		},
		getCodexAuthState: async () => (await codexAuth?.getStatus())?.state ?? 'not_configured',
		getInternalStatus: async () => supervisor?.getInternalStatus() ?? null,
		getModelWorkaroundEnabled: () => routingSettings.getGpt54ToGpt55WorkaroundEnabled(),
		getModelWorkaroundDecision: () => routingSettings.getGpt54ToGpt55WorkaroundDecision(),
		setModelWorkaroundDecision: (decision) => routingSettings.setGpt54ToGpt55WorkaroundDecision(decision),
		environmentLabel: detectExtensionHostEnvironment(vscode.env.remoteName),
		getCloudflaredProvisionResult: () => lastCloudflaredProvisionResult,
		restartRuntime: async () => {
			if (!supervisor) {
				throw new Error('Runtime supervisor is not available');
			}
			const snapshot = await supervisor.restart();
			await updateStatusBar();
			return snapshot;
		},
		provisionQuickTunnelBinary: async () => {
			if (cloudflaredBinaryPath) {
				lastCloudflaredProvisionResult = { status: 'ready', binaryPath: cloudflaredBinaryPath };
				return lastCloudflaredProvisionResult;
			}
			const result = await provisioner.provision();
			lastCloudflaredProvisionResult = result;
			cloudflaredBinaryPath = result.status === 'ready' ? result.binaryPath ?? null : null;
			return result;
		}
	});
	activeSetupCoordinator = setupCoordinator;
	const dashboardSetupMutationGuard = new SetupMutationGuard();
	updateStatusBar = async (): Promise<void> => {
		const model = await setupCoordinator.getStatusBarViewModel();
		statusBar.text = model.text;
		statusBar.tooltip = model.tooltip;
		if (model.visible) {
			statusBar.show();
		} else {
			statusBar.hide();
		}
	};

	context.subscriptions.push(
		statusBar,
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
		vscode.commands.registerCommand('codexAuthExt.openDashboard', () => {
			const panel = vscode.window.createWebviewPanel(
				'codexAuthDashboard',
				'Codex Auth Dashboard',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dashboard')]
				}
			);
			panel.webview.html = buildDashboardWebviewHtml({
				extensionPath: context.extensionPath,
				extensionUri: context.extensionUri,
				webview: panel.webview,
				toResourceUri: (relativePath) => vscode.Uri.joinPath(context.extensionUri, 'dashboard', ...relativePath.split('/'))
			});
			dashboardWebviews.add(panel.webview);
			panel.onDidDispose(() => dashboardWebviews.delete(panel.webview), null, context.subscriptions);
			context.subscriptions.push(attachDashboardBridge(panel, setupCoordinator, vscode.env.clipboard, updateStatusBar, dashboardSetupMutationGuard));
		}),
		vscode.commands.registerCommand('codexAuthExt.copyCursorSetup', async () => {
			try {
				assertSetupCopyAllowed(dashboardSetupMutationGuard);
				await vscode.env.clipboard.writeText(await setupCoordinator.copyCursorSetupValue('full'));
				const cursorBaseUrl = setupCoordinator.getCursorBaseUrl();
				void vscode.window.showInformationMessage(
					cursorBaseUrl
						? `Copied verified Cursor setup for ${cursorBaseUrl}.`
						: 'Copied local setup details. Verify a public HTTPS Extension Base URL before pasting the Base URL into Cursor.'
				);
			} catch (error) {
				void vscode.window.showErrorMessage(readErrorMessage(error));
			}
		}),
		vscode.commands.registerCommand('codexAuthExt.copyExtensionBaseUrl', async () => {
			try {
				assertSetupCopyAllowed(dashboardSetupMutationGuard);
				await vscode.env.clipboard.writeText(await setupCoordinator.copyCursorSetupValue('base_url'));
				void vscode.window.showInformationMessage('Copied verified Extension Base URL for Cursor.');
			} catch (error) {
				void vscode.window.showErrorMessage(readErrorMessage(error));
			}
		}),
		vscode.commands.registerCommand('codexAuthExt.copyLocalApiKey', async () => {
			try {
				assertSetupCopyAllowed(dashboardSetupMutationGuard);
				await vscode.env.clipboard.writeText(await setupCoordinator.copyCursorSetupValue('api_key'));
				void vscode.window.showInformationMessage('Copied local API key. Paste it only into Cursor OpenAI-compatible settings.');
			} catch (error) {
				void vscode.window.showErrorMessage(readErrorMessage(error));
			}
		}),
		vscode.commands.registerCommand('codexAuthExt.doctorCheckSetup', async () => {
			try {
				await vscode.env.clipboard.writeText(await setupCoordinator.runDoctorMarkdown());
				void vscode.window.showInformationMessage('Codex setup doctor report copied to clipboard.');
			} catch (error) {
				void vscode.window.showErrorMessage(readErrorMessage(error));
			}
		}),
		vscode.commands.registerCommand('codexAuthExt.restartRuntime', async () => {
			if (!supervisor) {
				return;
			}

			const snapshot = await supervisor.restart();
			await updateStatusBar();
			void vscode.window.showInformationMessage(`Runtime restarted: ${snapshot.phase}`);
		}),
		vscode.commands.registerCommand('codexAuthExt.restartTunnel', async () => {
			try {
				const tunnel = await runGuardedSetupMutation(dashboardSetupMutationGuard, 'command.restartTunnel', () => setupCoordinator.restartQuickTunnel());
				await updateStatusBar();
				void vscode.window.showInformationMessage(`Quick Tunnel ${tunnel.state}${tunnel.url ? ` at ${tunnel.url}` : ''}`);
			} catch (error) {
				void vscode.window.showErrorMessage(readErrorMessage(error));
			}
		}),
		vscode.commands.registerCommand('codexAuthExt.signInCodex', async () => {
			if (!codexAuth) {
				return;
			}

			let callbackServer: Awaited<ReturnType<typeof waitForOAuthCallback>> | null = null;
			try {
				const state = crypto.randomUUID();
				callbackServer = await waitForOAuthCallback({ state });
				const callbackPreparation = await prepareOAuthCallbackForBrowser(callbackServer.redirectUri, {
					parseUri: vscode.Uri.parse,
					asExternalUri: vscode.env.asExternalUri
				});
				if (!callbackPreparation.prepared || !callbackPreparation.compatibleWithFixedRedirect) {
					void vscode.window.showWarningMessage(
						'Codex sign-in callback may need manual SSH port forwarding for localhost:1455.'
					);
				}
				const started = await codexAuth.startOAuth(callbackServer.redirectUri, state);
				await vscode.env.openExternal(vscode.Uri.parse(started.url));
				const callback = await callbackServer.waitForCallback;
				await codexAuth.completeOAuth(callback.code, started.codeVerifier, callbackServer.redirectUri);
				const snapshot = await supervisor?.restart();
				await updateStatusBar();
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
				await updateStatusBar();
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
			await updateStatusBar();
			void vscode.window.showInformationMessage(
				`Codex auth removed${snapshot ? `; runtime ${snapshot.phase}` : ''}`
			);
		}),
		vscode.commands.registerCommand('codexAuthExt.enableGpt55Workaround', () => setModelWorkaroundDecisionFromCommand(setupCoordinator, updateStatusBar, dashboardSetupMutationGuard, 'enabled')),
		vscode.commands.registerCommand('codexAuthExt.skipGpt55Workaround', () => setModelWorkaroundDecisionFromCommand(setupCoordinator, updateStatusBar, dashboardSetupMutationGuard, 'skipped')),
		vscode.commands.registerCommand('codexAuthExt.decideLaterGpt55Workaround', () => setModelWorkaroundDecisionFromCommand(setupCoordinator, updateStatusBar, dashboardSetupMutationGuard, 'decide_later')),

		{
			dispose: () => {
				void quickTunnel.stop();
				void supervisor?.stop();
			}
		}
	);

	const snapshot = await supervisor.start();
	await updateStatusBar();

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


async function broadcastSetupState(webviews: Set<vscode.Webview>, setupCoordinator: SetupCoordinator): Promise<void> {
	if (webviews.size === 0) {
		return;
	}
	const state = await setupCoordinator.getSetupState();
	await Promise.all(Array.from(webviews, (webview) => webview.postMessage({
		requestId: 'setup-state-refresh',
		type: 'extension.setupState',
		state
	})));
}

async function setModelWorkaroundDecisionFromCommand(
	setupCoordinator: SetupCoordinator,
	updateStatusBar: () => Promise<void>,
	setupMutationGuard: SetupMutationGuard,
	decision: ModelWorkaroundDecision
): Promise<void> {
	try {
		const state = await runGuardedSetupMutation(
			setupMutationGuard,
			`command.modelWorkaround.${decision}`,
			() => setupCoordinator.setModelWorkaroundDecision(decision)
		);
		await updateStatusBar();
		const status = state.items.find((item) => item.id === 'harness-workaround')?.guidance ?? `Harness Routing Workaround ${decision}.`;
		void vscode.window.showInformationMessage(status);
	} catch (error) {
		void vscode.window.showErrorMessage(readErrorMessage(error));
	}
}

function spawnTunnelProcess(binaryPath: string | null, args: string[]): TunnelProcess {
	if (!binaryPath) {
		throw new Error('cloudflared is not provisioned');
	}

	const child = spawn(binaryPath, args, {
		stdio: ['ignore', 'pipe', 'pipe']
	});

	return {
		pid: child.pid,
		stdout: streamLines(child.stdout),
		stderr: streamLines(child.stderr),
		exit: new Promise((resolve) => {
			child.once('exit', (code, signal) => resolve({ code, signal }));
		}),
		kill: (signal) => {
			child.kill(signal);
		}
	};
}

async function* streamLines(stream: NodeJS.ReadableStream | null): AsyncIterable<string> {
	if (!stream) return;
	let buffered = '';
	for await (const chunk of stream) {
		buffered += String(chunk);
		let newline = buffered.indexOf('\n');
		while (newline >= 0) {
			yield buffered.slice(0, newline);
			buffered = buffered.slice(newline + 1);
			newline = buffered.indexOf('\n');
		}
	}
	if (buffered) {
		yield buffered;
	}
}

export async function deactivate(): Promise<void> {
	await activeQuickTunnel?.stop();
	activeQuickTunnel = null;
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

	if (error instanceof CodexAuthError && error.code === 'account_id_missing') {
		return {
			ok: false as const,
			code: 'account_id_missing' as const,
			message: 'Codex account id is missing'
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
