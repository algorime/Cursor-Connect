<script lang="ts">
	import type { NotificationPreference } from '@codex-auth-ext/shared';
	import ChoiceGroup from '../components/ChoiceGroup.svelte';
	import type { PreferencesViewModel } from '../dashboard-state.js';
	import {
		createDashboardInteractionState,
		disabledReasonFor,
		isActionDisabled,
		isActionPending,
		type DashboardActionKey,
		type DashboardInteractionState
	} from '../interaction-state.js';
	export let preferences: PreferencesViewModel;
	export let interactionState: DashboardInteractionState = createDashboardInteractionState();
	export let onStatusBarPreference: (preference: 'visible' | 'hidden') => void = () => undefined;
	export let onNotificationPreference: (preference: NotificationPreference) => void = () => undefined;
	export let onOpenAiRepair: (decision: 'enabled' | 'skipped' | 'disabled') => void = () => undefined;

	const statusBarOptions = [
		{ value: 'visible', label: 'Visible', description: 'Show the Codex setup status in the VS Code status bar.' },
		{ value: 'hidden', label: 'Hidden', description: 'Keep the dashboard available but hide status bar surface area.' }
	];
	const notificationOptions = [
		{ value: 'important_only', label: 'Important only', description: 'Only show important setup and failure notifications.' },
		{ value: 'balanced', label: 'Balanced', description: 'Show important updates without noisy progress spam.' },
		{ value: 'verbose', label: 'Verbose', description: 'Show more setup and diagnostic notifications.' }
	];
	const openAiRepairOptions = [
		{ value: 'enabled', label: 'Enabled', description: 'Use the compatibility repair when available.' },
		{ value: 'skipped', label: 'Skipped', description: 'Leave the repair off for now.' },
		{ value: 'disabled', label: 'Disabled', description: 'Disable the repair path explicitly.' }
	];

	let pendingStatusBarPreference: 'visible' | 'hidden' | null = null;
	let pendingNotificationPreference: NotificationPreference | null = null;
	let pendingOpenAiRepair: 'enabled' | 'skipped' | 'disabled' | null = null;

	$: actionView = {
		set_status_bar_preference: view('set_status_bar_preference'),
		set_notification_preference: view('set_notification_preference'),
		set_openai_key_repair_decision: view('set_openai_key_repair_decision')
	};
	$: selectedStatusBarPreference = pending('set_status_bar_preference') && pendingStatusBarPreference
		? pendingStatusBarPreference
		: preferences.statusBarPreference;
	$: selectedNotificationPreference = pending('set_notification_preference') && pendingNotificationPreference
		? pendingNotificationPreference
		: preferences.notificationPreference;
	$: selectedOpenAiRepair = pending('set_openai_key_repair_decision') && pendingOpenAiRepair
		? pendingOpenAiRepair
		: preferences.openAiKeyRepairDecision;
	$: openAiRepairUnavailable = preferences.openAiKeyRepair.unavailable;

	function view(action: DashboardActionKey): { pending: boolean; disabled: boolean; reason: string | null } {
		return {
			pending: isActionPending(interactionState, action),
			disabled: isActionDisabled(interactionState, action),
			reason: disabledReasonFor(interactionState, action)
		};
	}

	function pending(action: DashboardActionKey): boolean {
		return actionView[action].pending;
	}

	function actionDisabled(action: DashboardActionKey): boolean {
		return actionView[action].disabled;
	}

	function reason(action: DashboardActionKey): string | null {
		return actionView[action].reason;
	}

	function selectStatusBarPreference(value: string): void {
		const preference = value as 'visible' | 'hidden';
		pendingStatusBarPreference = preference;
		onStatusBarPreference(preference);
	}

	function selectNotificationPreference(value: string): void {
		const preference = value as NotificationPreference;
		pendingNotificationPreference = preference;
		onNotificationPreference(preference);
	}


	function selectOpenAiRepair(value: string): void {
		const decision = value as 'enabled' | 'skipped' | 'disabled';
		pendingOpenAiRepair = decision;
		onOpenAiRepair(decision);
	}
</script>

<section class="page preferences-page">
	<header class="page-header">
		<p class="eyebrow">Preferences</p>
		<h1>Dashboard preferences</h1>
		<p>Phase 3 settings only: status bar, notifications, and compatibility repair.</p>
	</header>

	<div class="preferences-grid">
		<section class="card">
			<h2>Status bar</h2>
			<p>Choose whether Codex appears in the VS Code status bar.</p>
			<ChoiceGroup
				label="Status bar preference"
				options={statusBarOptions}
				selectedValue={selectedStatusBarPreference}
				pendingValue={preferences.pendingStatusBarPreference}
				pending={pending('set_status_bar_preference')}
				disabled={actionDisabled('set_status_bar_preference')}
				disabledReason={reason('set_status_bar_preference')}
				pendingLabel="Updating status bar…"
				onSelect={selectStatusBarPreference}
			/>
			{#if reason('set_status_bar_preference')}<p class="disabled-reason">{reason('set_status_bar_preference')}</p>{/if}
		</section>
		<section class="card">
			<h2>Notifications</h2>
			<p>Choose how much dashboard activity should surface outside this page.</p>
			<ChoiceGroup
				label="Notification preference"
				options={notificationOptions}
				selectedValue={selectedNotificationPreference}
				pendingValue={preferences.pendingNotificationPreference}
				pending={pending('set_notification_preference')}
				disabled={actionDisabled('set_notification_preference')}
				disabledReason={reason('set_notification_preference')}
				pendingLabel="Updating notifications…"
				onSelect={selectNotificationPreference}
			/>
			{#if reason('set_notification_preference')}<p class="disabled-reason">{reason('set_notification_preference')}</p>{/if}
		</section>
		<section class="card">
			<h2>OpenAI-key repair</h2>
			<p>{preferences.openAiKeyRepair.summary}</p>
			{#if openAiRepairUnavailable}
				<p class="disabled-reason">Unavailable on this host / not required for Ready.</p>
			{:else}
				<ChoiceGroup
					label="OpenAI-key repair decision"
					options={openAiRepairOptions}
					selectedValue={selectedOpenAiRepair}
					pendingValue={preferences.pendingOpenAiKeyRepairDecision}
					pending={pending('set_openai_key_repair_decision')}
					disabled={actionDisabled('set_openai_key_repair_decision')}
					disabledReason={reason('set_openai_key_repair_decision') ?? preferences.openAiKeyRepair.disabledReason}
					pendingLabel="Updating repair…"
					onSelect={selectOpenAiRepair}
				/>
			{/if}
			{#if reason('set_openai_key_repair_decision')}<p class="disabled-reason">{reason('set_openai_key_repair_decision')}</p>{/if}
		</section>
	</div>
</section>
