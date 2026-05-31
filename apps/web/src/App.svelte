<script lang="ts">
	import type { NotificationPreference } from '@codex-auth-ext/shared';
	import DashboardShell from './components/DashboardShell.svelte';
	import DiagnosticsPage from './pages/DiagnosticsPage.svelte';
	import HomePage from './pages/HomePage.svelte';
	import PreferencesPage from './pages/PreferencesPage.svelte';
	import SetupPage from './pages/SetupPage.svelte';
	import type { VsCodeWebviewApi } from './bridge.js';
	import type { DashboardActionId, DashboardPageId, DashboardViewModel } from './dashboard-state.js';
	import {
		createDashboardInteractionState,
		disabledReasonFor,
		globalActivity,
		initialLoadingActivity,
		isActionDisabled,
		isActionPending,
		type DashboardActionKey,
		type DashboardInteractionState,
		type GlobalActivity,
		type InitialLoadingActivity
	} from './interaction-state.js';

	export let dashboard: DashboardViewModel | null = null;
	export let actionMessage: string | null = null;
	export let interactionState: DashboardInteractionState = createDashboardInteractionState();
	export let activity: GlobalActivity = globalActivity(interactionState);
	export let loadingActivity: InitialLoadingActivity = initialLoadingActivity(Date.now(), Date.now());
	export let onSignInCodex: () => void = () => undefined;
	export let onImportCodexAuth: () => void = () => undefined;
	export let onRecheckAuth: () => void = () => undefined;
	export let onVerifyPublicUrl: (url: string) => void = () => undefined;
	export let onCopyFullSetup: () => void = () => undefined;
	export let onCopyBaseUrl: () => void = () => undefined;
	export let onCopyApiKey: () => void = () => undefined;
	export let onCopyModels: () => void = () => undefined;
	export let onMarkManualConfirmation: (confirmed: boolean) => void = () => undefined;
	export let onRunDoctor: () => void = () => undefined;
	export let onRotateLocalApiKey: () => void = () => undefined;
	export let onSetOpenAiKeyRepairDecision: (decision: 'enabled' | 'skipped' | 'decide_later' | 'disabled') => void = () => undefined;
	export let onSetStatusBarPreference: (preference: 'visible' | 'hidden') => void = () => undefined;
	export let onSetNotificationPreference: (preference: NotificationPreference) => void = () => undefined;
	export let onOpenCursorSettings: () => void = () => undefined;
	export let onStartQuickTunnel: () => void = () => undefined;
	export let onStopQuickTunnel: () => void = () => undefined;
	export let onRestartQuickTunnel: () => void = () => undefined;
	export let vscode: VsCodeWebviewApi | null = null;

	let activePage: DashboardPageId = restoreActivePage(vscode);
	let publicUrl = '';

	$: if (dashboard && !dashboard.nav.some((item) => item.id === activePage && !item.disabled)) {
		activePage = 'home';
	}

	function selectPage(page: DashboardPageId): void {
		if (dashboard?.nav.find((item) => item.id === page && !item.disabled)) {
			activePage = page;
			persistActivePage(vscode, activePage);
		}
	}

	function restoreActivePage(api: VsCodeWebviewApi | null): DashboardPageId {
		const state = api?.getState?.();
		return isDashboardWebviewState(state) ? state.activePage : 'home';
	}

	function persistActivePage(api: VsCodeWebviewApi | null, page: DashboardPageId): void {
		const state = api?.getState?.();
		const nextState = isRecord(state) ? { ...state, activePage: page } : { activePage: page };
		api?.setState?.(nextState);
	}

	function isDashboardWebviewState(value: unknown): value is { activePage: DashboardPageId } {
		return isRecord(value)
			&& typeof value.activePage === 'string'
			&& ['home', 'setup', 'diagnostics', 'preferences'].includes(value.activePage);
	}

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null;
	}

	function handleAction(id: string): void {
		switch (id as DashboardActionId | 'copy_base_url' | 'copy_api_key' | 'copy_models' | 'rotate_local_api_key') {
			case 'sign_in_codex':
				onSignInCodex();
				break;
			case 'import_codex_auth':
				onImportCodexAuth();
				break;
			case 'recheck_auth':
				onRecheckAuth();
				break;
			case 'start_quick_tunnel':
				onStartQuickTunnel();
				break;
			case 'stop_quick_tunnel':
				onStopQuickTunnel();
				break;
			case 'restart_quick_tunnel':
				onRestartQuickTunnel();
				break;
			case 'open_setup':
				selectPage('setup');
				break;
			case 'verify_public_url':
				onVerifyPublicUrl(publicUrl);
				break;
			case 'run_doctor':
				onRunDoctor();
				break;
			case 'copy_full_setup':
				onCopyFullSetup();
				break;
			case 'copy_base_url':
				onCopyBaseUrl();
				break;
			case 'copy_api_key':
				onCopyApiKey();
				break;
			case 'copy_models':
				onCopyModels();
				break;
			case 'open_cursor_settings':
				onOpenCursorSettings();
				break;
			case 'mark_cursor_confirmed':
				onMarkManualConfirmation(true);
				break;
			case 'rotate_local_api_key':
				onRotateLocalApiKey();
				break;
		}
	}

	function actionLabel(id: DashboardActionId | undefined): string | null {
		switch (id) {
			case 'sign_in_codex':
				return 'Sign in to Codex';
			case 'import_codex_auth':
				return 'Import Codex auth';
			case 'recheck_auth':
				return 'Recheck auth';
			case 'copy_base_url':
				return 'Copy Extension Base URL';
			case 'run_doctor':
				return 'Run doctor';
			case 'open_setup':
				return 'Open Stable Setup';
			case 'open_cursor_settings':
				return 'Open Cursor settings';
			default:
				return null;
		}
	}

	function toInteractionAction(id: string | undefined): DashboardActionKey | null {
		switch (id) {
			case 'sign_in_codex':
			case 'import_codex_auth':
			case 'recheck_auth':
			case 'start_quick_tunnel':
			case 'stop_quick_tunnel':
			case 'restart_quick_tunnel':
			case 'verify_public_url':
			case 'mark_cursor_confirmed':
			case 'copy_full_setup':
			case 'copy_base_url':
			case 'copy_api_key':
			case 'copy_models':
			case 'open_cursor_settings':
			case 'run_doctor':
			case 'rotate_local_api_key':
				return id;
			default:
				return null;
		}
	}

	function actionPending(id: string | undefined): boolean {
		const action = toInteractionAction(id);
		return action ? isActionPending(interactionState, action) : false;
	}

	function actionDisabled(id: string | undefined, baseDisabled = false): boolean {
		const action = toInteractionAction(id);
		return action ? isActionDisabled(interactionState, action, baseDisabled) : baseDisabled;
	}

	function actionDisabledReason(id: string | undefined, baseReason: string | null = null): string | null {
		const action = toInteractionAction(id);
		return action ? disabledReasonFor(interactionState, action, baseReason) : baseReason;
	}

</script>

{#if dashboard}
	<DashboardShell nav={dashboard.nav} {activePage} {actionMessage} {activity} onSelect={selectPage}>
		{#if activePage === 'home'}
			<HomePage
				home={dashboard.home}
				{interactionState}
				secondaryLabel={actionLabel(dashboard.home.nextAction.secondary)}
				primaryPending={actionPending(dashboard.home.nextAction.primary)}
				secondaryPending={actionPending(dashboard.home.nextAction.secondary)}
				primaryDisabled={actionDisabled(dashboard.home.nextAction.primary, dashboard.home.nextAction.primary === 'none')}
				secondaryDisabled={actionDisabled(dashboard.home.nextAction.secondary)}
				primaryDisabledReason={actionDisabledReason(dashboard.home.nextAction.primary)}
				secondaryDisabledReason={actionDisabledReason(dashboard.home.nextAction.secondary)}
				onAction={handleAction}
			/>
		{:else if activePage === 'setup'}
			<SetupPage
				setup={dashboard.setup}
				{interactionState}
				{activity}
				{publicUrl}
				onPublicUrlInput={(value) => publicUrl = value}
				onAction={handleAction}
				onOpenAiRepair={(decision) => onSetOpenAiKeyRepairDecision(decision)}
			/>
		{:else if activePage === 'diagnostics'}
			<DiagnosticsPage diagnostics={dashboard.diagnostics} {interactionState} onRunDoctor={onRunDoctor} />
		{:else if activePage === 'preferences'}
			<PreferencesPage
				preferences={dashboard.preferences}
				{interactionState}
				onStatusBarPreference={onSetStatusBarPreference}
				onNotificationPreference={onSetNotificationPreference}
				onOpenAiRepair={(decision) => onSetOpenAiKeyRepairDecision(decision)}
			/>
		{/if}
	</DashboardShell>
{:else}
	<main class="loading-shell">
		<p class="eyebrow">Codex Auth-First</p>
		<h1>Loading Codex dashboard</h1>
		<p>{loadingActivity.message}</p>
		{#if loadingActivity.recovery}<p class="recovery-text">{loadingActivity.recovery}</p>{/if}
	</main>
{/if}

<style>
	:global(body) {
		margin: 0;
		background: var(--vscode-editor-background);
		color: var(--vscode-editor-foreground);
		font-family: var(--vscode-font-family);
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(button),
	:global(input) {
		font: inherit;
	}

	:global(button) {
		border: 0;
		border-radius: 0.45rem;
		padding: 0.5rem 0.75rem;
		background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
		color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
		cursor: pointer;
	}

	:global(button:disabled) {
		cursor: not-allowed;
		opacity: 0.55;
	}

	:global(button.primary) {
		background: var(--vscode-button-background);
		color: var(--vscode-button-foreground);
	}

	:global(button.secondary) {
		background: var(--vscode-button-secondaryBackground, transparent);
		color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground));
		border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
	}

	:global(button.danger) {
		background: var(--vscode-inputValidation-errorBackground, var(--vscode-button-background));
		color: var(--vscode-inputValidation-errorForeground, var(--vscode-button-foreground));
		border: 1px solid var(--vscode-inputValidation-errorBorder, transparent);
	}

	:global(input) {
		width: 100%;
		background: var(--vscode-input-background);
		color: var(--vscode-input-foreground);
		border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
		border-radius: 0.45rem;
		padding: 0.55rem 0.65rem;
	}

	:global(.dashboard-shell) {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		min-height: 100vh;
	}

	:global(.sidebar) {
		border-right: 1px solid var(--vscode-panel-border);
		background: var(--vscode-sideBar-background, var(--vscode-editor-background));
		padding: 1rem;
	}

	:global(.brand) {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	:global(.brand-mark) {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.65rem;
		background: var(--vscode-badge-background);
		color: var(--vscode-badge-foreground);
		font-weight: 700;
	}

	:global(.brand small),
	:global(.eyebrow),
	:global(.page-header p),
	:global(.hero p),
	:global(.card p),
	:global(dd),
	:global(dt) {
		color: var(--vscode-descriptionForeground);
	}

	:global(.sidebar ul),
	:global(.compact-checklist ul) {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	:global(.sidebar li + li) {
		margin-top: 0.35rem;
	}

	:global(.sidebar button) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		background: transparent;
		color: var(--vscode-sideBar-foreground, var(--vscode-editor-foreground));
		text-align: left;
	}

	:global(.sidebar button.active) {
		background: var(--vscode-list-activeSelectionBackground);
		color: var(--vscode-list-activeSelectionForeground);
	}

	:global(.sidebar button.disabled) {
		opacity: 0.6;
	}

	:global(.sidebar em) {
		font-style: normal;
		font-size: 0.75rem;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--vscode-panel-border);
		border-radius: 999px;
	}

	:global(.content-shell),
	.loading-shell {
		padding: 1.25rem;
	}

	:global(.page) {
		display: grid;
		gap: 1rem;
		max-width: 78rem;
	}

	:global(.page-header),
	:global(.hero),
	:global(.card) {
		border: 1px solid var(--vscode-panel-border);
		border-radius: 0.9rem;
		background: var(--vscode-editorWidget-background, transparent);
		padding: 1rem;
	}

	:global(.hero) {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}

	:global(.hero-ready) {
		border-color: var(--vscode-testing-iconPassed, var(--vscode-panel-border));
	}

	:global(.hero-blocked) {
		border-color: var(--vscode-testing-iconFailed, var(--vscode-panel-border));
	}

	:global(.eyebrow) {
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
	}

	:global(h1),
	:global(h2),
	:global(h3),
	:global(p) {
		margin-top: 0;
	}



	:global(.command-center) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
		gap: 1rem;
	}

	:global(.command-card) {
		border-left: 0.3rem solid var(--vscode-panel-border);
	}

	:global(.command-complete),
	:global(.route-authenticated_ready) {
		border-left-color: var(--vscode-testing-iconPassed, var(--vscode-panel-border));
	}

	:global(.command-active),
	:global(.command-warning),
	:global(.route-route_health_ok),
	:global(.route-wrong_runtime),
	:global(.route-timeout),
	:global(.route-unreachable),
	:global(.route-wrong_key),
	:global(.route-not_configured) {
		border-left-color: var(--vscode-testing-iconQueued, var(--vscode-panel-border));
	}

	:global(.route-facts dd) {
		word-break: break-all;
	}

	:global(.home-grid),
	:global(.security-grid),
	:global(.preferences-grid) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
	}

	:global(.setup-stack),
	:global(.diagnostic-groups) {
		display: grid;
		gap: 1rem;
	}

	:global(.readiness-grid) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.75rem;
	}

	:global(.actions),
	:global(.hero-chips),
	:global(.warning-strip) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	:global(.field-row),
	:global(.setup-facts),
	:global(.facts-card dl) {
		display: grid;
		gap: 0.5rem;
	}

	:global(.chip) {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		border: 1px solid var(--vscode-panel-border);
		padding: 0.2rem 0.55rem;
		font-size: 0.8rem;
	}

	:global(.chip-success) {
		border-color: var(--vscode-testing-iconPassed, var(--vscode-panel-border));
	}

	:global(.chip-warning) {
		border-color: var(--vscode-testing-iconQueued, var(--vscode-panel-border));
		color: var(--vscode-editorWarning-foreground, var(--vscode-editor-foreground));
	}

	:global(.readiness),
	:global(.check-item),
	:global(.doctor-card) {
		border-left: 0.25rem solid var(--vscode-panel-border);
	}

	:global(.readiness-complete),
	:global(.check-complete),
	:global(.doctor-pass) {
		border-left-color: var(--vscode-testing-iconPassed, var(--vscode-panel-border));
	}

	:global(.readiness-active),
	:global(.readiness-warning),
	:global(.check-active),
	:global(.check-warning),
	:global(.doctor-warn) {
		border-left-color: var(--vscode-testing-iconQueued, var(--vscode-panel-border));
	}

	:global(.readiness-blocked),
	:global(.check-blocked),
	:global(.doctor-fail) {
		border-left-color: var(--vscode-testing-iconFailed, var(--vscode-panel-border));
	}

	:global(.check-item),
	:global(.doctor-card) {
		padding: 0.65rem 0 0.65rem 0.75rem;
	}

	:global(.check-item div),
	:global(.readiness div),
	:global(.split) {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
	}

	:global(pre) {
		overflow: auto;
		max-height: 12rem;
		background: var(--vscode-textCodeBlock-background);
		padding: 0.75rem;
		border-radius: 0.45rem;
	}

	:global(.notice) {
		border: 1px solid var(--vscode-panel-border);
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--vscode-notifications-background, var(--vscode-editorWidget-background));
	}

	:global(.activity-dock) {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 50;
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		width: min(28rem, calc(100vw - 2.5rem));
		border: 1px solid var(--vscode-panel-border);
		border-radius: 0.9rem;
		padding: 0.85rem 1rem;
		background: var(--vscode-notifications-background, var(--vscode-editorWidget-background));
		box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 28%);
	}

	:global(.activity-dock p),
	:global(.disabled-reason),
	.recovery-text {
		margin: 0.35rem 0 0;
		color: var(--vscode-descriptionForeground);
		font-size: 0.88rem;
	}

	:global(.activity-dot) {
		width: 0.7rem;
		height: 0.7rem;
		margin-top: 0.25rem;
		border-radius: 999px;
		background: var(--vscode-progressBar-background, var(--vscode-badge-background));
		box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--vscode-progressBar-background, var(--vscode-badge-background)) 18%, transparent);
	}

	:global(.activity-error) {
		border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-testing-iconFailed));
	}

	:global(.activity-success) {
		border-color: var(--vscode-testing-iconPassed, var(--vscode-panel-border));
	}

	:global(.choice-group) {
		display: grid;
		gap: 0.65rem;
	}

	:global(.choice-card) {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: flex-start;
		width: 100%;
		border: 1px solid var(--vscode-panel-border);
		border-radius: 0.75rem;
		padding: 0.75rem;
		background: var(--vscode-editorWidget-background, transparent);
		color: var(--vscode-editor-foreground);
		text-align: left;
	}

	:global(.choice-card:hover:not(:disabled)) {
		border-color: var(--vscode-focusBorder, var(--vscode-panel-border));
		background: var(--vscode-list-hoverBackground, var(--vscode-editorWidget-background));
	}

	:global(.choice-selected) {
		border-color: var(--vscode-focusBorder, var(--vscode-button-background));
		background: color-mix(in srgb, var(--vscode-button-background) 18%, var(--vscode-editorWidget-background, transparent));
		box-shadow: inset 0.25rem 0 0 var(--vscode-button-background);
	}

	:global(.choice-check) {
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		border: 1px solid var(--vscode-panel-border);
		border-radius: 999px;
		color: var(--vscode-button-foreground);
		background: transparent;
		font-weight: 700;
	}

	:global(.choice-selected .choice-check) {
		border-color: var(--vscode-button-background);
		background: var(--vscode-button-background);
	}

	:global(.choice-copy) {
		display: grid;
		gap: 0.25rem;
	}

	:global(.choice-copy small) {
		color: var(--vscode-descriptionForeground);
		line-height: 1.35;
	}

	:global(.choice-badge) {
		align-self: center;
		border: 1px solid var(--vscode-focusBorder, var(--vscode-panel-border));
		border-radius: 999px;
		padding: 0.15rem 0.45rem;
		font-size: 0.75rem;
		color: var(--vscode-editor-foreground);
	}

	:global(.pending-card) {
		border-color: var(--vscode-progressBar-background, var(--vscode-focusBorder));
	}

	:global(.danger-confirm) {
		display: grid;
		gap: 0.65rem;
		margin-top: 0.75rem;
		border: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-panel-border));
		border-radius: 0.75rem;
		padding: 0.75rem;
		background: var(--vscode-inputValidation-warningBackground, var(--vscode-editorWidget-background));
	}

	:global(.danger-confirm p) {
		margin: 0;
		color: var(--vscode-editor-foreground);
	}

	:global(button[aria-busy="true"]) {
		position: relative;
	}

	@media (max-width: 760px) {
		:global(.dashboard-shell) {
			grid-template-columns: 1fr;
		}

		:global(.sidebar) {
			border-right: 0;
			border-bottom: 1px solid var(--vscode-panel-border);
		}

		:global(.sidebar ul) {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
			gap: 0.35rem;
		}

		:global(.activity-dock) {
			right: 0.75rem;
			bottom: 0.75rem;
			width: calc(100vw - 1.5rem);
		}
	}
</style>
