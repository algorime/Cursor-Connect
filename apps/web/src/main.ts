import type { DoctorReport, ExtensionToDashboardMessage, NotificationPreference, SetupState } from '@codex-auth-ext/shared';
import App from './App.svelte';
import {
	copyCursorSetup,
	markManualConfirmation,
	openCursorSettings,
	requestSetupState,
	recheckAuth,
	importCodexAuth,
	restartQuickTunnel,
	rotateLocalApiKey,
	runDoctor,
	setOpenAiKeyRepairDecision,
	setNotificationPreference,
	setStatusBarPreference,
	signInCodex,
	startQuickTunnel,
	stopQuickTunnel,
	verifyPublicUrl,
	type VsCodeWebviewApi
} from './bridge.js';
import { buildDashboardViewModel } from './dashboard-state.js';
import type { DashboardViewModel } from './dashboard-state.js';
import {
	applyInteractionTimers,
	completeInteraction,
	createDashboardInteractionState,
	disabledReasonFor,
	failInteraction,
	globalActivity,
	initialLoadingActivity,
	interactionForRequestId,
	isActionDisabled,
	isActionPending,
	startInteraction,
	type DashboardActionKey,
	type DashboardInteractionState
} from './interaction-state.js';

declare const acquireVsCodeApi: (() => VsCodeWebviewApi) | undefined;

declare global {
	// Test/host cleanup hook for repeated module imports in jsdom and webview reloads.
	// eslint-disable-next-line no-var
	var __codexAuthDashboardTeardown: (() => void) | undefined;
}

export interface DashboardAppHandle {
	destroy(): void;
}

export function mountDashboardApp(target: HTMLElement, vscode: VsCodeWebviewApi | null = resolveVsCodeApi()): DashboardAppHandle {
	const loadingStartedAt = Date.now();
	let lastState: SetupState | null = null;
	let lastDoctorReport: DoctorReport | null = null;
	let actionMessage: string | null = null;
	let interactionState: DashboardInteractionState = createDashboardInteractionState(loadingStartedAt);
	let optimisticStatusBarPreference: 'visible' | 'hidden' | null = null;
	let optimisticNotificationPreference: NotificationPreference | null = null;
	let optimisticOpenAiKeyRepairDecision: 'enabled' | 'skipped' | 'disabled' | null = null;

	const app = new App({
		target,
		props: {
			dashboard: null,
			actionMessage: null,
			interactionState,
			activity: globalActivity(interactionState, loadingStartedAt),
			loadingActivity: initialLoadingActivity(loadingStartedAt, loadingStartedAt),
			onSignInCodex: () => dispatchAction('sign_in_codex', () => vscode && signInCodex(vscode)),
			onImportCodexAuth: () => dispatchAction('import_codex_auth', () => vscode && importCodexAuth(vscode)),
			onRecheckAuth: () => dispatchAction('recheck_auth', () => vscode && recheckAuth(vscode)),
			onVerifyPublicUrl: (url: string) => dispatchAction('verify_public_url', () => vscode && verifyPublicUrl(vscode, url)),
			onCopyFullSetup: () => dispatchAction('copy_full_setup', () => vscode && copyCursorSetup(vscode, 'full')),
			onCopyBaseUrl: () => dispatchAction('copy_base_url', () => vscode && copyCursorSetup(vscode, 'base_url')),
			onCopyApiKey: () => dispatchAction('copy_api_key', () => vscode && copyCursorSetup(vscode, 'api_key')),
			onCopyModels: () => dispatchAction('copy_models', () => vscode && copyCursorSetup(vscode, 'models')),
			onMarkManualConfirmation: (confirmed: boolean) => dispatchAction('mark_cursor_confirmed', () => vscode && markManualConfirmation(vscode, confirmed)),
			onRunDoctor: () => dispatchAction('run_doctor', () => vscode && runDoctor(vscode)),
			onRotateLocalApiKey: () => dispatchAction('rotate_local_api_key', () => vscode && rotateLocalApiKey(vscode)),
			onSetOpenAiKeyRepairDecision: (decision: 'enabled' | 'skipped' | 'decide_later' | 'disabled') => {
				optimisticOpenAiKeyRepairDecision = decision === 'decide_later' ? null : decision;
				dispatchAction('set_openai_key_repair_decision', () => vscode && setOpenAiKeyRepairDecision(vscode, decision));
			},
			onSetStatusBarPreference: (preference: 'visible' | 'hidden') => {
				optimisticStatusBarPreference = preference;
				dispatchAction('set_status_bar_preference', () => vscode && setStatusBarPreference(vscode, preference));
			},
			onSetNotificationPreference: (preference: NotificationPreference) => {
				optimisticNotificationPreference = preference;
				dispatchAction('set_notification_preference', () => vscode && setNotificationPreference(vscode, preference));
			},
			onOpenCursorSettings: () => dispatchAction('open_cursor_settings', () => vscode && openCursorSettings(vscode)),
			onStartQuickTunnel: () => dispatchAction('start_quick_tunnel', () => vscode && startQuickTunnel(vscode)),
			onStopQuickTunnel: () => dispatchAction('stop_quick_tunnel', () => vscode && stopQuickTunnel(vscode)),
			onRestartQuickTunnel: () => dispatchAction('restart_quick_tunnel', () => vscode && restartQuickTunnel(vscode))
		}
	});

	const onMessage = (event: MessageEvent<ExtensionToDashboardMessage>): void => {
		const message = event.data;
		if (message.type === 'extension.setupState') {
			lastState = message.state;
			if (interactionForRequestId(interactionState, message.requestId)) {
				interactionState = completeInteraction(interactionState, message.requestId, 'Setup state refreshed.');
			}
			render();
			return;
		}
		if (message.type === 'extension.publicUrlVerified' && lastState) {
			lastState = { ...lastState, publicUrl: message.state };
			interactionState = completeInteraction(interactionState, message.requestId, 'Public URL verified.');
			render();
			return;
		}
		if (message.type === 'extension.quickTunnelStatus' && lastState) {
			lastState = { ...lastState, tunnel: message.status };
			render();
			if (vscode) {
				requestSetupState(vscode, message.requestId);
			}
			return;
		}
		if (message.type === 'extension.doctorReport') {
			lastDoctorReport = message.report;
			interactionState = completeInteraction(interactionState, message.requestId, 'Doctor report refreshed.');
			render();
			return;
		}
		if (message.type === 'extension.actionComplete') {
			const pending = interactionForRequestId(interactionState, message.requestId);
			if (pending?.action !== 'rotate_local_api_key') {
				interactionState = completeInteraction(interactionState, message.requestId, message.message);
			}
			actionMessage = message.message;
			render();
			return;
		}
		if (message.type === 'extension.error') {
			interactionState = failInteraction(interactionState, message.requestId, message.message);
			actionMessage = message.message;
			render();
		}
	};

	window.addEventListener('message', onMessage);

	if (vscode) {
		requestSetupState(vscode);
	}

	const timer = window.setInterval(() => {
		interactionState = applyInteractionTimers(interactionState, Date.now());
		render();
	}, 500);

	function dispatchAction(action: DashboardActionKey, post: () => string | null): void {
		const now = Date.now();
		interactionState = applyInteractionTimers(interactionState, now);
		if (isActionDisabled(interactionState, action)) {
			actionMessage = disabledReasonFor(interactionState, action);
			render();
			return;
		}
		const requestId = post();
		if (!requestId) {
			return;
		}
		actionMessage = null;
		interactionState = startInteraction(interactionState, action, requestId, now);
		render();
	}

	function render(): void {
		const now = Date.now();
		interactionState = applyInteractionTimers(interactionState, now);
		const dashboard = lastState ? withOptimisticChoices(buildDashboardViewModel(lastState, { doctorReport: lastDoctorReport })) : null;
		app.$set({
			dashboard,
			actionMessage,
			interactionState,
			activity: globalActivity(interactionState, now),
			loadingActivity: initialLoadingActivity(loadingStartedAt, now)
		});
	}

	function withOptimisticChoices(dashboard: DashboardViewModel): DashboardViewModel {
		if (optimisticStatusBarPreference && isActionPending(interactionState, 'set_status_bar_preference')) {
			dashboard.preferences.statusBarPreference = optimisticStatusBarPreference;
			dashboard.preferences.pendingStatusBarPreference = optimisticStatusBarPreference;
		}
		if (optimisticNotificationPreference && isActionPending(interactionState, 'set_notification_preference')) {
			dashboard.preferences.notificationPreference = optimisticNotificationPreference;
			dashboard.preferences.pendingNotificationPreference = optimisticNotificationPreference;
		}
		if (optimisticOpenAiKeyRepairDecision && isActionPending(interactionState, 'set_openai_key_repair_decision')) {
			dashboard.preferences.openAiKeyRepairDecision = optimisticOpenAiKeyRepairDecision;
			dashboard.preferences.pendingOpenAiKeyRepairDecision = optimisticOpenAiKeyRepairDecision;
			dashboard.setup.openAiKeyRepairDecision = optimisticOpenAiKeyRepairDecision;
			dashboard.setup.pendingOpenAiKeyRepairDecision = optimisticOpenAiKeyRepairDecision;
		}
		return dashboard;
	}

	return {
		destroy(): void {
			window.clearInterval(timer);
			window.removeEventListener('message', onMessage);
			app.$destroy();
		}
	};
}

function resolveVsCodeApi(): VsCodeWebviewApi | null {
	return typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
}

function autoMountDashboard(): DashboardAppHandle {
	const target = document.getElementById('app');
	if (!target) {
		throw new Error('Dashboard mount point missing');
	}
	return mountDashboardApp(target);
}

const autoHandle = autoMountDashboard();
globalThis.__codexAuthDashboardTeardown = () => {
	autoHandle.destroy();
	globalThis.__codexAuthDashboardTeardown = undefined;
};
