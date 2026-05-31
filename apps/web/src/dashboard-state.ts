import { buildVerifiedExtensionBaseUrl, type DoctorCheck, type DoctorReport, type PublicUrlState, type SetupChecklistItem, type SetupState } from '@codex-auth-ext/shared';

export type DashboardPageId = 'home' | 'setup' | 'diagnostics' | 'preferences' | 'usage' | 'accounts' | 'logs-support';
export type DashboardActionId =
	| 'sign_in_codex'
	| 'import_codex_auth'
	| 'recheck_auth'
	| 'run_doctor'
	| 'start_quick_tunnel'
	| 'stop_quick_tunnel'
	| 'restart_quick_tunnel'
	| 'open_setup'
	| 'verify_public_url'
	| 'copy_full_setup'
	| 'copy_base_url'
	| 'open_cursor_settings'
	| 'mark_cursor_confirmed'
	| 'none';

export interface DashboardNavItem {
	id: DashboardPageId;
	label: string;
	active: boolean;
	disabled: boolean;
	badge?: 'Later';
}

export interface DashboardActionViewModel {
	id: DashboardActionId;
	label: string;
	description: string;
	primary: DashboardActionId;
	secondary?: DashboardActionId;
}

export interface ReadinessCardViewModel {
	id: string;
	label: string;
	status: SetupChecklistItem['status'];
	guidance: string;
}

export interface DashboardFact {
	label: string;
	value: string;
	fullValue?: string;
	tone?: 'default' | 'warning' | 'success';
}

export interface CommandCenterFact {
	label: string;
	value: string;
	tone?: 'default' | 'warning' | 'success';
}

export interface AuthCommandCenterViewModel {
	status: SetupChecklistItem['status'];
	title: string;
	summary: string;
	primaryAction: DashboardActionId;
	primaryLabel: string;
	secondaryAction: DashboardActionId;
	secondaryLabel: string;
	recheckAction: DashboardActionId;
	facts: CommandCenterFact[];
}

export interface RouteCommandCenterViewModel {
	status: PublicUrlState['state'];
	title: string;
	summary: string;
	primaryAction: DashboardActionId;
	primaryLabel: string;
	secondaryAction: DashboardActionId;
	secondaryLabel: string;
	canCopyBaseUrl: boolean;
	facts: CommandCenterFact[];
}

export interface DashboardCommandCenterViewModel {
	auth: AuthCommandCenterViewModel;
	route: RouteCommandCenterViewModel;
}

export interface DashboardHomeViewModel {
	mode: 'setup' | 'ready' | 'blocked';
	headline: string;
	blockingItem: SetupChecklistItem | null;
	badges: string[];
	items: SetupChecklistItem[];
	nextAction: DashboardActionViewModel;
	readinessCards: ReadinessCardViewModel[];
	warningChips: string[];
	facts: DashboardFact[];
	commandCenter: DashboardCommandCenterViewModel;
}

export interface DashboardSetupViewModel {
	localTargetUrl: string | null;
	publicRouteUrl: string | null;
	publicRouteUrlLabel: 'Temporary Public Route URL' | 'Durable Public Route URL' | 'Public Route URL';
	cursorExtensionBaseUrl: string | null;
	publicUrlState: PublicUrlState;
	statusMessages: string[];
	canCopyFinalSetup: boolean;
	canCopyBaseUrl: boolean;
	openAiKeyRepairDecision: VisibleOpenAiKeyRepairDecision;
	openAiKeyRepair: OpenAiKeyRepairViewModel;
	pendingOpenAiKeyRepairDecision: VisibleOpenAiKeyRepairDecision;
	modelDecisionRequired: boolean;
	durableExamples: Array<{ label: string; summary: string }>;
	commandCenter: DashboardCommandCenterViewModel;
}

export interface DoctorCardViewModel {
	id: string;
	label: string;
	status: DoctorCheck['status'];
	guidance: string;
	details?: Record<string, unknown>;
}

export interface DiagnosticsViewModel {
	groups: Record<DoctorCheck['status'], DoctorCardViewModel[]>;
}

export interface PreferencesViewModel {
	statusBarPreference: SetupState['statusBarPreference'];
	notificationPreference: SetupState['notificationPreference'];
	openAiKeyRepairDecision: VisibleOpenAiKeyRepairDecision;
	openAiKeyRepair: OpenAiKeyRepairViewModel;
	pendingStatusBarPreference: SetupState['statusBarPreference'] | null;
	pendingNotificationPreference: SetupState['notificationPreference'] | null;
	pendingOpenAiKeyRepairDecision: VisibleOpenAiKeyRepairDecision;
}

type VisibleOpenAiKeyRepairDecision = 'enabled' | 'skipped' | 'disabled' | null;

export interface OpenAiKeyRepairViewModel {
	decision: VisibleOpenAiKeyRepairDecision;
	capability: 'available' | 'unavailable';
	reason: string | null;
	unavailable: boolean;
	summary: string;
	disabledReason: string | null;
}

export interface DashboardViewModel {
	activePage: Exclude<DashboardPageId, 'usage' | 'accounts' | 'logs-support'>;
	nav: DashboardNavItem[];
	home: DashboardHomeViewModel;
	setup: DashboardSetupViewModel;
	diagnostics: DiagnosticsViewModel | null;
	preferences: PreferencesViewModel;
}

const ACTIVE_PAGES = new Set<DashboardViewModel['activePage']>(['home', 'setup', 'diagnostics', 'preferences']);

export function buildDashboardViewModel(
	state: SetupState,
	options: { activePage?: DashboardPageId; doctorReport?: DoctorReport | null } = {}
): DashboardViewModel {
	const activePage = normalizeDashboardPage(options.activePage);
	return {
		activePage,
		nav: buildNav(activePage),
		home: buildDashboardHomeViewModel(state),
		setup: buildSetupViewModel(state),
		diagnostics: options.doctorReport ? buildDiagnosticsViewModel(options.doctorReport) : null,
		preferences: {
			statusBarPreference: state.statusBarPreference,
			notificationPreference: state.notificationPreference,
			openAiKeyRepairDecision: visibleOpenAiKeyRepairDecision(state.openAiKeyRepair?.decision),
			openAiKeyRepair: buildOpenAiKeyRepairViewModel(state),
			pendingStatusBarPreference: null,
			pendingNotificationPreference: null,
			pendingOpenAiKeyRepairDecision: null
		}
	};
}

export function buildDashboardHomeViewModel(state: SetupState): DashboardHomeViewModel {
	const visibleItems = visibleSetupItems(state.items);
	const blockingItem = visibleItems.find((item) => item.status === 'blocked')
		?? visibleItems.find((item) => item.status === 'active')
		?? null;
	const mode = state.readiness.state === 'ready' ? 'ready' : state.readiness.state === 'blocked' ? 'blocked' : 'setup';

	return {
		mode,
		headline: mode === 'ready' ? 'Codex is ready' : mode === 'blocked' ? 'Repair Codex setup' : 'Finish Codex setup',
		blockingItem,
		badges: buildBadges(state),
		items: visibleItems,
		nextAction: buildNextAction(state, blockingItem),
		readinessCards: buildReadinessCards(state),
		warningChips: buildWarningChips(state),
		facts: buildHomeFacts(state),
		commandCenter: buildCommandCenter(state)
	};
}

export function normalizeDashboardPage(page: DashboardPageId | undefined): DashboardViewModel['activePage'] {
	return page && ACTIVE_PAGES.has(page as DashboardViewModel['activePage'])
		? page as DashboardViewModel['activePage']
		: 'home';
}

export function shortenUrlForHome(value: string | null): string | null {
	if (!value) return null;
	try {
		const parsed = new URL(value);
		const path = parsed.pathname.replace(/\/$/, '');
		return `${parsed.host}${path && path !== '/' ? path : ''}`;
	} catch {
		return value.length > 48 ? `${value.slice(0, 45)}…` : value;
	}
}

export function buildDiagnosticsViewModel(report: DoctorReport): DiagnosticsViewModel {
	const mapCheck = (check: DoctorCheck): DoctorCardViewModel => ({
		id: check.id,
		label: check.label,
		status: check.status,
		guidance: check.guidance,
		details: check.details
	});
	return {
		groups: {
			pass: report.groups.pass.map(mapCheck),
			warn: report.groups.warn.map(mapCheck),
			fail: report.groups.fail.map(mapCheck)
		}
	};
}

function buildNav(activePage: DashboardViewModel['activePage']): DashboardNavItem[] {
	return [
		{ id: 'home', label: 'Home', active: activePage === 'home', disabled: false },
		{ id: 'setup', label: 'Setup', active: activePage === 'setup', disabled: false },
		{ id: 'diagnostics', label: 'Diagnostics', active: activePage === 'diagnostics', disabled: false },
		{ id: 'preferences', label: 'Preferences', active: activePage === 'preferences', disabled: false },
		{ id: 'usage', label: 'Usage', active: false, disabled: true, badge: 'Later' },
		{ id: 'accounts', label: 'Accounts', active: false, disabled: true, badge: 'Later' },
		{ id: 'logs-support', label: 'Logs & Support', active: false, disabled: true, badge: 'Later' }
	];
}


function visibleSetupItems(items: SetupChecklistItem[]): SetupChecklistItem[] {
	return items.filter((item) => item.id !== 'harness-workaround');
}

function buildNextAction(state: SetupState, blockingItem: SetupChecklistItem | null): DashboardActionViewModel {
	if (state.readiness.state === 'ready') {
		return {
			id: 'none',
			label: 'Codex is ready',
			description: state.publicUrl.temporary
				? 'Cursor traffic is verified. The current route is a temporary Quick Tunnel, so keep the warning in mind.'
				: 'Cursor traffic is verified through the current Extension Base URL.',
			primary: 'none',
			secondary: 'run_doctor'
		};
	}

	if (state.readiness.state === 'blocked') {
		return {
			id: 'run_doctor',
			label: 'Run doctor',
			description: blockingItem?.guidance ?? 'Find the blocking setup issue before changing Cursor settings.',
			primary: 'run_doctor'
		};
	}

	if (itemStatus(state, 'codex-auth') !== 'complete') {
		return {
			id: 'sign_in_codex',
			label: 'Complete Codex authentication',
			description: 'Sign in or import Codex auth directly from the dashboard, then recheck auth if the state does not refresh.',
			primary: 'sign_in_codex',
			secondary: 'import_codex_auth'
		};
	}

	if (itemStatus(state, 'public-url') !== 'complete') {
		const staleQuickTunnel = isStaleQuickTunnel(state.publicUrl);
		return {
			id: state.tunnel.state === 'running' ? 'restart_quick_tunnel' : 'start_quick_tunnel',
			label: staleQuickTunnel || state.tunnel.state === 'running' ? 'Restart Quick Tunnel' : 'Start Quick Tunnel',
			description: staleQuickTunnel
				? 'Restart Quick Tunnel, copy the new Extension Base URL, and update Cursor settings before sending another request.'
				: 'Fast Start creates and verifies a temporary Extension Base URL before you copy values into Cursor.',
			primary: state.tunnel.state === 'running' ? 'restart_quick_tunnel' : 'start_quick_tunnel',
			secondary: 'open_setup'
		};
	}

	if (itemStatus(state, 'cursor-setup') !== 'complete') {
		if (state.cursorSetup?.manualConfirmed && !state.cursorSetup.staleReason) {
			return {
				id: 'open_cursor_settings',
				label: 'Open Cursor and send a test request',
				description: 'Cursor values are marked confirmed. Send one request from Cursor through the Extension Base URL so the dashboard can observe current setup traffic.',
				primary: 'open_cursor_settings',
				secondary: 'run_doctor'
			};
		}

		return {
			id: 'copy_full_setup',
			label: 'Copy and confirm Cursor setup',
			description: 'Copy the final Base URL, local API key, and model guidance, confirm the values in Cursor, then send one Cursor request.',
			primary: 'copy_full_setup',
			secondary: 'open_cursor_settings'
		};
	}

	return {
		id: 'mark_cursor_confirmed',
		label: 'Verify Cursor traffic',
		description: 'Send a Cursor request through the Extension Base URL so the dashboard can observe current setup traffic.',
		primary: 'mark_cursor_confirmed',
		secondary: 'run_doctor'
	};
}

function buildBadges(state: SetupState): string[] {
	const badges: string[] = [];
	if (state.environmentLabel) {
		badges.push(state.environmentLabel);
	}
	if (state.publicUrl.temporary && state.publicUrl.state === 'authenticated_ready') {
		badges.push('Temporary Extension Base URL');
	} else if (state.tunnel.state === 'running') {
		badges.push('Temporary Quick Tunnel');
	}
	if (state.publicUrl.state === 'authenticated_ready') {
		badges.push('Public URL verified');
	}
	if (state.apiTraffic.lastCursorFacingRequest) {
		badges.push('Cursor traffic detected');
	}
	return badges;
}

function buildReadinessCards(state: SetupState): ReadinessCardViewModel[] {
	const ids = new Set(['runtime', 'codex-auth', 'public-url', 'cursor-setup']);
	return visibleSetupItems(state.items)
		.filter((item) => ids.has(item.id))
		.map((item) => ({
			id: item.id,
			label: item.label,
			status: item.status,
			guidance: item.guidance
		}));
}

function buildWarningChips(state: SetupState): string[] {
	return [...new Set(state.readiness.warnings)];
}

function buildHomeFacts(state: SetupState): DashboardFact[] {
	const facts: DashboardFact[] = [];
	const publicUrl = shortenUrlForHome(state.publicUrl.url);
	if (publicUrl) {
		facts.push({
			label: state.publicUrl.temporary ? 'Temporary route' : 'Public route',
			value: publicUrl,
			fullValue: state.publicUrl.url ?? undefined,
			tone: state.publicUrl.state === 'authenticated_ready' ? 'success' : 'warning'
		});
	}
	const localTarget = shortenUrlForHome(state.localTargetUrl);
	if (localTarget) {
		facts.push({ label: 'Local target', value: localTarget, fullValue: state.localTargetUrl ?? undefined });
	}
	return facts;
}

function buildSetupViewModel(state: SetupState): DashboardSetupViewModel {
	const cursorExtensionBaseUrl = safeExtensionBaseUrl(state.publicUrl.url);
	return {
		localTargetUrl: state.localTargetUrl,
		publicRouteUrl: state.publicUrl.url,
		publicRouteUrlLabel: state.publicUrl.source === 'quick_tunnel'
			? 'Temporary Public Route URL'
			: state.publicUrl.source === 'user_provided'
				? 'Durable Public Route URL'
				: 'Public Route URL',
		cursorExtensionBaseUrl,
		publicUrlState: state.publicUrl,
		statusMessages: [
			state.tunnel.message,
			state.publicUrl.message
		].filter((message): message is string => Boolean(message)),
		canCopyFinalSetup: state.publicUrl.state === 'authenticated_ready',
		canCopyBaseUrl: state.publicUrl.state === 'authenticated_ready',
		openAiKeyRepairDecision: visibleOpenAiKeyRepairDecision(state.openAiKeyRepair?.decision),
		openAiKeyRepair: buildOpenAiKeyRepairViewModel(state),
		pendingOpenAiKeyRepairDecision: null,
		modelDecisionRequired: false,
		commandCenter: buildCommandCenter(state),
		durableExamples: [
			{ label: 'Cloudflare named tunnel', summary: 'Forward a stable hostname to the local forwarding target.' },
			{ label: 'Caddy or Nginx', summary: 'Terminate HTTPS on a user-owned domain and reverse proxy to the local target.' },
			{ label: 'Tailscale Funnel', summary: 'Expose the local target through a Tailscale-managed HTTPS route.' },
			{ label: 'ngrok reserved domain', summary: 'Use a reserved HTTPS domain and forward it to the local target.' }
		]
	};
}


function buildCommandCenter(state: SetupState): DashboardCommandCenterViewModel {
	return {
		auth: buildAuthCommandCenter(state),
		route: buildRouteCommandCenter(state)
	};
}

function buildAuthCommandCenter(state: SetupState): AuthCommandCenterViewModel {
	const authItem = state.items.find((item) => item.id === 'codex-auth');
	const status = authItem?.status ?? 'pending';
	const complete = status === 'complete';
	return {
		status,
		title: complete ? 'Codex Auth ready' : 'Codex Auth needed',
		summary: complete ? 'Codex authentication is available for the local runtime.' : authItem?.guidance ?? 'Sign in or import Codex auth before exposing a public route.',
		primaryAction: complete ? 'recheck_auth' : 'sign_in_codex',
		primaryLabel: complete ? 'Recheck auth' : 'Sign in to Codex',
		secondaryAction: complete ? 'run_doctor' : 'import_codex_auth',
		secondaryLabel: complete ? 'Run doctor' : 'Import Codex auth',
		recheckAction: 'recheck_auth',
		facts: [
			{ label: 'State', value: complete ? 'Authenticated' : readableChecklistStatus(status), tone: complete ? 'success' : 'warning' },
			{ label: 'Runtime', value: state.localTargetUrl ? 'Local API reachable' : 'Runtime target unavailable', tone: state.localTargetUrl ? 'success' : 'warning' }
		]
	};
}

function buildRouteCommandCenter(state: SetupState): RouteCommandCenterViewModel {
	const publicRouteUrl = state.publicUrl.url;
	const extensionBaseUrl = safeExtensionBaseUrl(publicRouteUrl);
	const ready = state.publicUrl.state === 'authenticated_ready';
	const staleQuickTunnel = isStaleQuickTunnel(state.publicUrl);
	const hasRunningTunnel = state.tunnel.state === 'running';
	const primaryAction: DashboardActionId = ready ? 'copy_base_url' : hasRunningTunnel ? 'restart_quick_tunnel' : 'start_quick_tunnel';
	return {
		status: state.publicUrl.state,
		title: ready ? 'Public Route verified' : routeTitle(state.publicUrl),
		summary: ready
			? 'Public route reaches this extension runtime. Copy the /v1 Extension Base URL into Cursor.'
			: state.publicUrl.message ?? 'Start Quick Tunnel for a fast temporary route or verify a durable Public Route URL.',
		primaryAction,
		primaryLabel: ready ? 'Copy Extension Base URL' : staleQuickTunnel || hasRunningTunnel ? 'Restart Quick Tunnel' : 'Start Quick Tunnel',
		secondaryAction: ready ? 'restart_quick_tunnel' : 'open_setup',
		secondaryLabel: ready ? 'Restart Quick Tunnel' : 'Open durable setup',
		canCopyBaseUrl: ready,
		facts: [
			{ label: 'Public Route URL', value: publicRouteUrl ?? 'Not verified yet', tone: ready ? 'success' : 'warning' },
			{ label: 'Cursor Extension Base URL', value: extensionBaseUrl ?? 'Available after route verification', tone: ready ? 'success' : 'warning' },
			{ label: 'Health check', value: publicRouteUrl ? `${publicRouteUrl}/health` : '/health pending' },
			{ label: 'Authenticated ready check', value: publicRouteUrl ? `${publicRouteUrl}/ready` : '/ready pending' },
			{ label: 'Runtime Proof', value: state.publicUrl.runtimeId ? `current: ${state.publicUrl.runtimeId}` : 'Missing or not verified', tone: state.publicUrl.runtimeId ? 'success' : 'warning' },
			{ label: 'Route kind', value: state.publicUrl.temporary ? 'Temporary Quick Tunnel' : state.publicUrl.source === 'user_provided' ? 'Durable route' : 'Not configured' }
		]
	};
}

function safeExtensionBaseUrl(publicRouteUrl: string | null): string | null {
	if (!publicRouteUrl) return null;
	try {
		return buildVerifiedExtensionBaseUrl(publicRouteUrl, { allowHttpForTests: true });
	} catch {
		return null;
	}
}

function routeTitle(publicUrl: PublicUrlState): string {
	if (isStaleQuickTunnel(publicUrl)) return 'Temporary Quick Tunnel is stale';
	if (publicUrl.state === 'wrong_runtime') return 'Route stale or wrong runtime';
	if (publicUrl.state === 'wrong_key') return 'Route rejected local API key';
	if (publicUrl.state === 'route_health_ok') return 'Route health OK, ready blocked';
	if (publicUrl.state === 'timeout') return 'Route timed out';
	if (publicUrl.state === 'unreachable') return 'Route unreachable';
	return 'Public Route needed';
}

function isStaleQuickTunnel(publicUrl: PublicUrlState): boolean {
	return publicUrl.source === 'quick_tunnel'
		&& publicUrl.temporary === true
		&& publicUrl.state !== 'authenticated_ready'
		&& /stale|no longer running|no longer resolvable|old Extension Base URL/i.test(publicUrl.message ?? '');
}

function readableChecklistStatus(status: SetupChecklistItem['status']): string {
	return status.replace(/_/g, ' ');
}

function itemStatus(state: SetupState, id: string): SetupChecklistItem['status'] | null {
	return state.items.find((item) => item.id === id)?.status ?? null;
}

function visibleOpenAiKeyRepairDecision(decision: NonNullable<SetupState['openAiKeyRepair']>['decision'] | undefined): VisibleOpenAiKeyRepairDecision {
	return decision === 'enabled' || decision === 'skipped' || decision === 'disabled'
		? decision
		: null;
}

function buildOpenAiKeyRepairViewModel(state: SetupState): OpenAiKeyRepairViewModel {
	const status = state.openAiKeyRepair;
	const decision = visibleOpenAiKeyRepairDecision(status?.decision);
	const capability = status?.capability ?? 'unavailable';
	const reason = status?.reason ?? null;
	const unavailable = capability !== 'available';
	return {
		decision,
		capability,
		reason,
		unavailable,
		summary: unavailable
			? `Unavailable on this host${reason ? ` (${reason})` : ''}. Not required for Ready.`
			: 'Available but non-blocking. Enable only if Cursor compatibility repair is needed.',
		disabledReason: unavailable ? 'OpenAI-key repair is unavailable on this host and is not required for Ready.' : null
	};
}
