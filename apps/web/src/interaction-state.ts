export type DashboardActionKey =
	| 'sign_in_codex'
	| 'import_codex_auth'
	| 'recheck_auth'
	| 'start_quick_tunnel'
	| 'stop_quick_tunnel'
	| 'restart_quick_tunnel'
	| 'verify_public_url'
	| 'mark_cursor_confirmed'
	| 'rotate_local_api_key'
	| 'set_openai_key_repair_decision'
	| 'set_status_bar_preference'
	| 'set_notification_preference'
	| 'copy_full_setup'
	| 'copy_base_url'
	| 'copy_api_key'
	| 'copy_models'
	| 'run_doctor'
	| 'open_cursor_settings';

export type DashboardActionFamily = 'setup-affecting' | 'read-sensitive-copy' | 'read-only' | 'local';
export type InteractionStatus = 'pending' | 'succeeded' | 'failed';
export type PendingStage = 'pending' | 'still-working' | 'stuck';
export type LoadingStage = 'loading' | 'still-waiting' | 'recovery';

export interface DashboardActionMetadata {
	key: DashboardActionKey;
	label: string;
	family: DashboardActionFamily;
}

export interface DashboardInteraction {
	action: DashboardActionKey;
	requestId: string;
	status: InteractionStatus;
	message: string;
	startedAt: number;
	updatedAt: number;
}

export interface DashboardInteractionState {
	interactions: DashboardInteraction[];
	now: number;
}

export interface GlobalActivity {
	kind: 'idle' | 'pending' | 'success' | 'error';
	stage?: PendingStage;
	action?: DashboardActionKey;
	requestId?: string;
	message: string;
	recovery?: string;
}

export interface InitialLoadingActivity {
	stage: LoadingStage;
	message: string;
	recovery?: string;
}

export const INITIAL_LOADING_STILL_WAITING_MS = 2_000;
export const INITIAL_LOADING_RECOVERY_MS = 8_000;
export const OPERATION_STILL_WORKING_MS = 8_000;
export const OPERATION_STUCK_MS = 60_000;
export const DEFAULT_SUCCESS_RETENTION_MS = 4_000;
export const COPY_SUCCESS_RETENTION_MS = 3_000;

const ACTIONS: Record<DashboardActionKey, DashboardActionMetadata> = {
	sign_in_codex: { key: 'sign_in_codex', label: 'Sign in to Codex', family: 'setup-affecting' },
	import_codex_auth: { key: 'import_codex_auth', label: 'Import Codex auth', family: 'setup-affecting' },
	recheck_auth: { key: 'recheck_auth', label: 'Recheck Codex auth', family: 'read-only' },
	start_quick_tunnel: { key: 'start_quick_tunnel', label: 'Start Quick Tunnel', family: 'setup-affecting' },
	stop_quick_tunnel: { key: 'stop_quick_tunnel', label: 'Stop Quick Tunnel', family: 'setup-affecting' },
	restart_quick_tunnel: { key: 'restart_quick_tunnel', label: 'Restart Quick Tunnel', family: 'setup-affecting' },
	verify_public_url: { key: 'verify_public_url', label: 'Verify public URL', family: 'setup-affecting' },
	mark_cursor_confirmed: { key: 'mark_cursor_confirmed', label: 'Mark Cursor confirmed', family: 'setup-affecting' },
	rotate_local_api_key: { key: 'rotate_local_api_key', label: 'Rotate local API key', family: 'setup-affecting' },
	set_openai_key_repair_decision: { key: 'set_openai_key_repair_decision', label: 'Update OpenAI-key repair', family: 'setup-affecting' },
	set_status_bar_preference: { key: 'set_status_bar_preference', label: 'Update status bar preference', family: 'setup-affecting' },
	set_notification_preference: { key: 'set_notification_preference', label: 'Update notification preference', family: 'setup-affecting' },
	copy_full_setup: { key: 'copy_full_setup', label: 'Copy full Cursor setup', family: 'read-sensitive-copy' },
	copy_base_url: { key: 'copy_base_url', label: 'Copy Base URL', family: 'read-sensitive-copy' },
	copy_api_key: { key: 'copy_api_key', label: 'Copy local API key', family: 'read-sensitive-copy' },
	copy_models: { key: 'copy_models', label: 'Copy model guidance', family: 'read-sensitive-copy' },
	run_doctor: { key: 'run_doctor', label: 'Run doctor', family: 'read-only' },
	open_cursor_settings: { key: 'open_cursor_settings', label: 'Open Cursor settings', family: 'local' }
};

export function createDashboardInteractionState(now = Date.now()): DashboardInteractionState {
	return { interactions: [], now };
}

export function getActionMetadata(action: DashboardActionKey): DashboardActionMetadata {
	return ACTIONS[action];
}

export function startInteraction(
	state: DashboardInteractionState,
	action: DashboardActionKey,
	requestId: string,
	now = state.now
): DashboardInteractionState {
	return applyInteractionTimers({
		now,
		interactions: [
			...state.interactions.filter((interaction) => interaction.status === 'pending' && interaction.requestId !== requestId),
			{
				action,
				requestId,
				status: 'pending',
				message: `${ACTIONS[action].label} started.`,
				startedAt: now,
				updatedAt: now
			}
		]
	}, now);
}

export function completeInteraction(
	state: DashboardInteractionState,
	requestId: string,
	message: string,
	now = state.now
): DashboardInteractionState {
	return updateInteraction(state, requestId, 'succeeded', message, now);
}

export function failInteraction(
	state: DashboardInteractionState,
	requestId: string,
	message: string,
	now = state.now
): DashboardInteractionState {
	return updateInteraction(state, requestId, 'failed', message, now);
}

export function applyInteractionTimers(state: DashboardInteractionState, now = state.now): DashboardInteractionState {
	return {
		now,
		interactions: state.interactions.filter((interaction) => {
			if (interaction.status === 'pending' || interaction.status === 'failed') {
				return true;
			}
			return now - interaction.updatedAt <= successRetentionMs(interaction.action);
		})
	};
}

export function currentSetupOperation(state: DashboardInteractionState): DashboardInteraction | null {
	return state.interactions.find((interaction) => interaction.status === 'pending' && ACTIONS[interaction.action].family === 'setup-affecting') ?? null;
}

export function isSetupLocked(state: DashboardInteractionState): boolean {
	return currentSetupOperation(state) !== null;
}


export function interactionForRequestId(state: DashboardInteractionState, requestId: string): DashboardInteraction | null {
	return state.interactions.find((interaction) => interaction.requestId === requestId) ?? null;
}

export function isActionPending(state: DashboardInteractionState, action: DashboardActionKey): boolean {
	return state.interactions.some((interaction) => interaction.action === action && interaction.status === 'pending');
}

export function isActionDisabled(state: DashboardInteractionState, action: DashboardActionKey, baseDisabled = false): boolean {
	if (baseDisabled || isActionPending(state, action)) {
		return true;
	}
	const family = ACTIONS[action].family;
	return isSetupLocked(state) && (family === 'setup-affecting' || family === 'read-sensitive-copy');
}

export function disabledReasonFor(state: DashboardInteractionState, action: DashboardActionKey, baseReason: string | null = null): string | null {
	if (isActionPending(state, action)) {
		return `${ACTIONS[action].label} is already in progress.`;
	}
	if (baseReason) {
		return baseReason;
	}
	if (!isSetupLocked(state)) {
		return null;
	}
	if (ACTIONS[action].family === 'read-sensitive-copy') {
		return 'Wait for setup to finish before copying values.';
	}
	if (ACTIONS[action].family === 'setup-affecting') {
		return 'Finish the current setup operation first.';
	}
	return null;
}

export function globalActivity(state: DashboardInteractionState, now = state.now): GlobalActivity {
	const activeState = applyInteractionTimers(state, now);
	const setupPending = activeState.interactions.find(
		(interaction) => interaction.status === 'pending' && ACTIONS[interaction.action].family === 'setup-affecting'
	);
	if (setupPending) {
		return pendingActivity(setupPending, now);
	}

	const failed = [...activeState.interactions].reverse().find((interaction) => interaction.status === 'failed');
	if (failed) {
		return {
			kind: 'error',
			action: failed.action,
			requestId: failed.requestId,
			message: failed.message
		};
	}

	const pending = activeState.interactions.find((interaction) => interaction.status === 'pending');
	if (pending) {
		return pendingActivity(pending, now);
	}

	const success = [...activeState.interactions]
		.filter((interaction) => interaction.status === 'succeeded')
		.sort((a, b) => b.updatedAt - a.updatedAt)[0];
	if (success) {
		return {
			kind: 'success',
			action: success.action,
			requestId: success.requestId,
			message: success.message
		};
	}

	return { kind: 'idle', message: '' };
}

function pendingActivity(interaction: DashboardInteraction, now: number): GlobalActivity {
	const stage = pendingStage(interaction, now);
	return {
		kind: 'pending',
		stage,
		action: interaction.action,
		requestId: interaction.requestId,
		message: pendingMessage(interaction, stage),
		recovery: stage === 'stuck'
			? 'Still working after a minute. You can refresh setup state, reload the dashboard, or run doctor as a read-only check.'
			: undefined
	};
}

export function pendingStage(interaction: DashboardInteraction, now: number): PendingStage {
	const elapsed = now - interaction.startedAt;
	if (elapsed >= OPERATION_STUCK_MS) return 'stuck';
	if (elapsed >= OPERATION_STILL_WORKING_MS) return 'still-working';
	return 'pending';
}

export function initialLoadingActivity(startedAt: number, now: number): InitialLoadingActivity {
	const elapsed = now - startedAt;
	if (elapsed >= INITIAL_LOADING_RECOVERY_MS) {
		return {
			stage: 'recovery',
			message: 'Still waiting for setup state from the extension host.',
			recovery: 'Reload the dashboard or restart the extension host if this does not recover.'
		};
	}
	if (elapsed >= INITIAL_LOADING_STILL_WAITING_MS) {
		return {
			stage: 'still-waiting',
			message: 'Still waiting for extension setup state…'
		};
	}
	return {
		stage: 'loading',
		message: 'Preparing setup state from the extension host.'
	};
}

function updateInteraction(
	state: DashboardInteractionState,
	requestId: string,
	status: Exclude<InteractionStatus, 'pending'>,
	message: string,
	now: number
): DashboardInteractionState {
	let matched = false;
	const interactions = state.interactions.map((interaction) => {
		if (interaction.requestId !== requestId) {
			return interaction;
		}
		matched = true;
		return { ...interaction, status, message, updatedAt: now };
	});
	return applyInteractionTimers({ now, interactions: matched ? interactions : state.interactions }, now);
}

function pendingMessage(interaction: DashboardInteraction, stage: PendingStage): string {
	const label = ACTIONS[interaction.action].label;
	if (stage === 'stuck') {
		return `${label} is still working.`;
	}
	if (stage === 'still-working') {
		return `${label} is taking longer than usual.`;
	}
	return `${label} in progress…`;
}

function successRetentionMs(action: DashboardActionKey): number {
	return ACTIONS[action].family === 'read-sensitive-copy' ? COPY_SUCCESS_RETENTION_MS : DEFAULT_SUCCESS_RETENTION_MS;
}
