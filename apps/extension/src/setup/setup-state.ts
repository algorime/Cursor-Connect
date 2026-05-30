import type {
	ApiTrafficStatus,
	CodexAuthState,
	PublicUrlState,
	QuickTunnelStatus,
	ModelWorkaroundDecision,
	NotificationPreference,
	OpenAiKeyRepairStatus,
	RuntimeSnapshot,
	SetupChecklistItem,
	CursorSetupReadiness,
	SetupReadiness,
	SetupState
} from '@codex-auth-ext/shared';

export type CursorSetupState = CursorSetupReadiness;

export interface ExtensionSetupStateInput {
	runtime: RuntimeSnapshot;
	codexAuthState: CodexAuthState;
	publicUrl: PublicUrlState;
	apiTraffic: ApiTrafficStatus;
	cursorSetup: CursorSetupState;
	modelWorkaround: ModelWorkaroundDecision;
	tunnel: QuickTunnelStatus;
	usageStorageState: 'ready' | 'degraded';
	environmentLabel: string;
	statusBarPreference: 'visible' | 'hidden';
	notificationPreference: NotificationPreference;
	openAiKeyRepair?: OpenAiKeyRepairStatus;
	now?: () => number;
}

export function buildExtensionSetupState(input: ExtensionSetupStateInput): SetupState {
	const effectiveInput = withEffectivePublicUrl(input);
	const items = buildItems(effectiveInput);
	return {
		generatedAt: (effectiveInput.now ?? Date.now)(),
		environmentLabel: effectiveInput.environmentLabel,
		statusBarPreference: effectiveInput.statusBarPreference,
		notificationPreference: effectiveInput.notificationPreference,
		openAiKeyRepair: effectiveInput.openAiKeyRepair,
		modelWorkaroundDecision: effectiveInput.modelWorkaround,
		localTargetUrl: effectiveInput.runtime.localTargetUrl,
		publicUrl: effectiveInput.publicUrl,
		apiTraffic: effectiveInput.apiTraffic,
		cursorSetup: effectiveInput.cursorSetup,
		tunnel: effectiveInput.tunnel,
		readiness: buildReadiness(effectiveInput, items),
		items
	};
}

function withEffectivePublicUrl(input: ExtensionSetupStateInput): ExtensionSetupStateInput {
	if (input.publicUrl.state !== 'authenticated_ready' || !input.publicUrl.url) {
		return input;
	}

	const expectedRuntimeId = input.runtime.runtimeId;
	if (expectedRuntimeId && !input.publicUrl.runtimeId) {
		return {
			...input,
			publicUrl: {
				...input.publicUrl,
				state: 'wrong_runtime',
				message: 'Public URL did not return current runtime proof; reverify this route.'
			}
		};
	}
	if (expectedRuntimeId && input.publicUrl.runtimeId && input.publicUrl.runtimeId !== expectedRuntimeId) {
		return {
			...input,
			publicUrl: {
				...input.publicUrl,
				state: 'wrong_runtime',
				message: 'Public URL was verified for a different extension runtime; reverify this route.'
			}
		};
	}

	if (input.publicUrl.source !== 'quick_tunnel') {
		return input;
	}

	const tunnelStillServesUrl = input.tunnel.state === 'running' && input.tunnel.url === input.publicUrl.url;
	if (tunnelStillServesUrl) {
		return input;
	}

	return {
		...input,
		publicUrl: {
			...input.publicUrl,
			state: 'route_health_ok',
			message: 'Quick Tunnel is no longer running for this temporary Public Route URL; restart Quick Tunnel before relying on this route.'
		}
	};
}

function buildItems(input: ExtensionSetupStateInput): SetupChecklistItem[] {
	const runtimeReady = input.runtime.phase === 'ready' || input.runtime.phase === 'running_health_only';
	const authReady = input.codexAuthState === 'authenticated';
	const publicReady = input.publicUrl.state === 'authenticated_ready';
	const trafficDetected = hasCurrentSetupTraffic(input);
	const cursorReady = input.cursorSetup.manualConfirmed && trafficDetected && !input.cursorSetup.staleReason;

	return [
		{
			id: 'runtime',
			label: 'Local API runtime',
			status: runtimeReady ? 'complete' : 'blocked',
			guidance: runtimeReady ? 'Local loopback API is reachable.' : input.runtime.message ?? 'Start or repair the local runtime.'
		},
		{
			id: 'codex-auth',
			label: 'Codex authentication',
			status: authReady ? 'complete' : runtimeReady ? 'active' : 'pending',
			guidance: authReady ? 'Codex auth is available.' : 'Sign in or import Codex auth.'
		},
		{
			id: 'public-url',
			label: 'Public Extension Base URL',
			status: publicReady ? 'complete' : authReady ? 'active' : 'pending',
			guidance: publicReady ? 'Verified public URL reaches this runtime.' : 'Start Quick Tunnel or verify a durable HTTPS public URL.'
		},
		{
			id: 'cursor-setup',
			label: 'Cursor setup',
			status: cursorReady ? 'complete' : publicReady ? 'active' : 'pending',
			guidance: cursorReady
				? 'Cursor setup is manually confirmed and current setup traffic was detected.'
				: 'Copy setup values, confirm them in Cursor, then verify traffic.'
		},
		{
			id: 'usage-storage',
			label: 'Usage storage',
			status: input.usageStorageState === 'ready' ? 'complete' : 'warning',
			guidance: input.usageStorageState === 'ready' ? 'Usage storage is available.' : 'Usage storage is degraded; proxying can continue.'
		}
	];
}

function buildReadiness(input: ExtensionSetupStateInput, items: SetupChecklistItem[]): SetupReadiness {
	const blockers = items
		.filter((item) => item.status === 'blocked' || item.status === 'active')
		.map((item) => item.label);
	const warnings = items
		.filter((item) => item.status === 'warning')
		.map((item) => item.label);

	if (input.publicUrl.temporary && input.publicUrl.state === 'authenticated_ready') {
		warnings.push('Temporary Extension Base URL');
	}

	if (blockers.length > 0) {
		return { state: items.some((item) => item.status === 'blocked') ? 'blocked' : 'setup', blockers, warnings };
	}

	const requiredIds = new Set(['runtime', 'codex-auth', 'public-url', 'cursor-setup']);
	const requiredComplete = items
		.filter((item) => requiredIds.has(item.id))
		.every((item) => item.status === 'complete');

	return {
		state: requiredComplete ? 'ready' : 'setup',
		blockers,
		warnings
	};
}

function hasCurrentSetupTraffic(input: ExtensionSetupStateInput): boolean {
	const lastTrafficAt = input.apiTraffic.lastCursorFacingRequest?.at;
	const confirmedAt = input.cursorSetup.confirmedAt;
	return typeof lastTrafficAt === 'number'
		&& typeof confirmedAt === 'number'
		&& lastTrafficAt >= confirmedAt;
}
