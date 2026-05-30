import type { DashboardToExtensionMessage, ExtensionToDashboardMessage, ModelWorkaroundDecision, NotificationPreference } from '@codex-auth-ext/shared';

export interface VsCodeWebviewApi {
	postMessage(message: DashboardToExtensionMessage): void;
}

export function requestSetupState(vscode: VsCodeWebviewApi, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.getSetupState' });
	return requestId;
}

export function verifyPublicUrl(vscode: VsCodeWebviewApi, url: string, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.verifyPublicUrl', url });
	return requestId;
}

export function runDoctor(vscode: VsCodeWebviewApi, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.runDoctor' });
	return requestId;
}


export function signInCodex(vscode: VsCodeWebviewApi, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.signInCodex' });
	return requestId;
}

export function importCodexAuth(vscode: VsCodeWebviewApi, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.importCodexAuth' });
	return requestId;
}

export function recheckAuth(vscode: VsCodeWebviewApi, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.recheckAuth' });
	return requestId;
}

export function copyCursorSetup(vscode: VsCodeWebviewApi, copyKind: 'full' | 'base_url' | 'api_key' | 'models', requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.copyCursorSetup', copyKind });
	return requestId;
}

export function markManualConfirmation(vscode: VsCodeWebviewApi, confirmed: boolean, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.markManualConfirmation', confirmed });
	return requestId;
}

export function rotateLocalApiKey(vscode: VsCodeWebviewApi, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.rotateLocalApiKey' });
	return requestId;
}

export function setOpenAiKeyRepairDecision(
	vscode: VsCodeWebviewApi,
	decision: 'enabled' | 'skipped' | 'decide_later' | 'disabled',
	requestId: string = crypto.randomUUID()
): string {
	vscode.postMessage({ requestId, type: 'dashboard.setOpenAiKeyRepairDecision', decision });
	return requestId;
}

export function setStatusBarPreference(vscode: VsCodeWebviewApi, preference: 'visible' | 'hidden', requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.setStatusBarPreference', preference });
	return requestId;
}

export function setNotificationPreference(vscode: VsCodeWebviewApi, preference: NotificationPreference, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.setNotificationPreference', preference });
	return requestId;
}

export function setModelWorkaroundDecision(vscode: VsCodeWebviewApi, decision: ModelWorkaroundDecision, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.setModelWorkaroundDecision', decision });
	return requestId;
}

export function openCursorSettings(vscode: VsCodeWebviewApi, query = 'OpenAI API Key', requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.openCursorSettings', query });
	return requestId;
}

export function startQuickTunnel(vscode: VsCodeWebviewApi, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.startQuickTunnel' });
	return requestId;
}

export function stopQuickTunnel(vscode: VsCodeWebviewApi, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.stopQuickTunnel' });
	return requestId;
}

export function restartQuickTunnel(vscode: VsCodeWebviewApi, requestId: string = crypto.randomUUID()): string {
	vscode.postMessage({ requestId, type: 'dashboard.restartQuickTunnel' });
	return requestId;
}

export function isSetupStateMessage(message: ExtensionToDashboardMessage): boolean {
	return message.type === 'extension.setupState';
}
