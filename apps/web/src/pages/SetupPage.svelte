<script lang="ts">
	import ActionCard from '../components/ActionCard.svelte';
	import ChoiceGroup from '../components/ChoiceGroup.svelte';
	import DangerAction from '../components/DangerAction.svelte';
	import StatusChip from '../components/StatusChip.svelte';
	import type { DashboardSetupViewModel } from '../dashboard-state.js';
	import {
		createDashboardInteractionState,
		disabledReasonFor,
		getActionMetadata,
		isActionDisabled,
		isActionPending,
		type DashboardActionKey,
		type DashboardInteractionState,
		type GlobalActivity
	} from '../interaction-state.js';

	export let setup: DashboardSetupViewModel;
	export let interactionState: DashboardInteractionState = createDashboardInteractionState();
	export let activity: GlobalActivity = { kind: 'idle', message: '' };
	export let publicUrl = '';
	export let onPublicUrlInput: (value: string) => void = () => undefined;
	export let onAction: (id: string) => void = () => undefined;
	export let onOpenAiRepair: (decision: 'enabled' | 'skipped' | 'disabled') => void = () => undefined;

	const openAiRepairOptions = [
		{ value: 'enabled', label: 'Enabled', description: 'Use the compatibility repair when available.' },
		{ value: 'skipped', label: 'Skipped', description: 'Leave the repair off for now.' },
		{ value: 'disabled', label: 'Disabled', description: 'Disable the repair path explicitly.' }
	];

	let pendingOpenAiRepair: 'enabled' | 'skipped' | 'disabled' | null = null;

	$: actionView = {
		sign_in_codex: view('sign_in_codex'),
		import_codex_auth: view('import_codex_auth'),
		recheck_auth: view('recheck_auth'),
		run_doctor: view('run_doctor'),
		start_quick_tunnel: view('start_quick_tunnel'),
		stop_quick_tunnel: view('stop_quick_tunnel'),
		restart_quick_tunnel: view('restart_quick_tunnel'),
		verify_public_url: view('verify_public_url'),
		set_model_workaround_decision: view('set_model_workaround_decision'),
		copy_full_setup: view('copy_full_setup'),
		copy_base_url: view('copy_base_url'),
		copy_api_key: view('copy_api_key'),
		copy_models: view('copy_models'),
		open_cursor_settings: view('open_cursor_settings'),
		mark_cursor_confirmed: view('mark_cursor_confirmed'),
		rotate_local_api_key: view('rotate_local_api_key'),
		set_openai_key_repair_decision: view('set_openai_key_repair_decision')
	};
	$: activeSetupOperation = activity.kind === 'pending' && activity.action
		? getActionMetadata(activity.action).family === 'setup-affecting'
		: false;
	$: copyApiKeyPending = activity.kind === 'pending' && activity.action === 'copy_api_key';
	$: copyApiKeyDisabled = activeSetupOperation || copyApiKeyPending || actionView.copy_api_key.disabled;
	$: verifyPublicUrlDisabled = activeSetupOperation || actionView.verify_public_url.disabled;
	$: selectedOpenAiRepairValue = pending('set_openai_key_repair_decision') && pendingOpenAiRepair
		? pendingOpenAiRepair
		: setup.openAiKeyRepairDecision;
	$: openAiRepairUnavailable = setup.openAiKeyRepair.unavailable;

	function view(action: DashboardActionKey): { pending: boolean; disabled: boolean; reason: string | null } {
		return {
			pending: isActionPending(interactionState, action),
			disabled: isActionDisabled(interactionState, action),
			reason: disabledReasonFor(interactionState, action)
		};
	}

	function pending(action: DashboardActionKey): boolean {
		return actionView[action].pending || (activity.kind === 'pending' && activity.action === action);
	}

	function actionDisabled(action: DashboardActionKey, baseDisabled = false): boolean {
		return actionView[action].disabled || baseDisabled || pending(action) || isBlockedByActiveSetup(action);
	}

	function reason(action: DashboardActionKey, baseReason: string | null = null): string | null {
		if (pending(action)) {
			return `${getActionMetadata(action).label} is already in progress.`;
		}
		if (isBlockedByActiveSetup(action)) {
			return getActionMetadata(action).family === 'read-sensitive-copy'
				? 'Wait for setup to finish before copying values.'
				: 'Finish the current setup operation first.';
		}
		return actionView[action].reason ?? baseReason;
	}

	function isBlockedByActiveSetup(action: DashboardActionKey): boolean {
		if (activity.kind !== 'pending' || !activity.action) {
			return false;
		}
		if (getActionMetadata(activity.action).family !== 'setup-affecting') {
			return false;
		}
		const family = getActionMetadata(action).family;
		return family === 'setup-affecting' || family === 'read-sensitive-copy';
	}


	function selectOpenAiRepair(value: string): void {
		const decision = value as 'enabled' | 'skipped' | 'disabled';
		pendingOpenAiRepair = decision;
		onOpenAiRepair(decision);
	}

</script>

<section class="page setup-page">
	<header class="page-header">
		<p class="eyebrow">Setup</p>
		<h1>Configure Cursor with Codex</h1>
		<p>Fast Start uses a temporary Quick Tunnel. Stable Setup uses your own durable HTTPS route.</p>
	</header>

	<div class="setup-stack">
<section class="command-center" aria-label="Codex auth and route command center">
		<section class={`card command-card command-${setup.commandCenter.auth.status}`}>
			<p class="eyebrow">Codex Auth</p>
			<h2>{setup.commandCenter.auth.title}</h2>
			<p>{setup.commandCenter.auth.summary}</p>
			<dl class="setup-facts">
				{#each setup.commandCenter.auth.facts as fact}
					<div><dt>{fact.label}</dt><dd class={`fact-${fact.tone ?? 'default'}`}>{fact.value}</dd></div>
				{/each}
			</dl>
			<div class="actions wrap">
				<button type="button" class="primary" disabled={actionDisabled(setup.commandCenter.auth.primaryAction as DashboardActionKey)} aria-busy={pending(setup.commandCenter.auth.primaryAction as DashboardActionKey)} title={reason(setup.commandCenter.auth.primaryAction as DashboardActionKey) ?? undefined} on:click={() => onAction(setup.commandCenter.auth.primaryAction)}>{pending(setup.commandCenter.auth.primaryAction as DashboardActionKey) ? `${setup.commandCenter.auth.primaryLabel}…` : setup.commandCenter.auth.primaryLabel}</button>
				<button type="button" class="secondary" disabled={actionDisabled(setup.commandCenter.auth.secondaryAction as DashboardActionKey)} aria-busy={pending(setup.commandCenter.auth.secondaryAction as DashboardActionKey)} title={reason(setup.commandCenter.auth.secondaryAction as DashboardActionKey) ?? undefined} on:click={() => onAction(setup.commandCenter.auth.secondaryAction)}>{pending(setup.commandCenter.auth.secondaryAction as DashboardActionKey) ? `${setup.commandCenter.auth.secondaryLabel}…` : setup.commandCenter.auth.secondaryLabel}</button>
				{#if setup.commandCenter.auth.status !== 'complete'}
					<button type="button" class="secondary" disabled={actionDisabled('recheck_auth')} aria-busy={pending('recheck_auth')} title={reason('recheck_auth') ?? undefined} on:click={() => onAction('recheck_auth')}>Recheck auth</button>
				{/if}
			</div>
		</section>

		<section class={`card command-card route-${setup.commandCenter.route.status}`}>
			<p class="eyebrow">Public Route / Cursor URL</p>
			<h2>{setup.commandCenter.route.title}</h2>
			<p>{setup.commandCenter.route.summary}</p>
			<dl class="setup-facts route-facts">
				{#each setup.commandCenter.route.facts as fact}
					<div><dt>{fact.label}</dt><dd class={`fact-${fact.tone ?? 'default'}`}>{fact.value}</dd></div>
				{/each}
			</dl>
			<div class="actions wrap">
				<button type="button" class="primary" disabled={actionDisabled(setup.commandCenter.route.primaryAction as DashboardActionKey, setup.commandCenter.route.primaryAction === 'copy_base_url' && !setup.commandCenter.route.canCopyBaseUrl)} aria-busy={pending(setup.commandCenter.route.primaryAction as DashboardActionKey)} title={reason(setup.commandCenter.route.primaryAction as DashboardActionKey) ?? undefined} on:click={() => onAction(setup.commandCenter.route.primaryAction)}>{pending(setup.commandCenter.route.primaryAction as DashboardActionKey) ? `${setup.commandCenter.route.primaryLabel}…` : setup.commandCenter.route.primaryLabel}</button>
				<button type="button" class="secondary" disabled={actionDisabled('verify_public_url')} aria-busy={pending('verify_public_url')} title={reason('verify_public_url') ?? undefined} on:click={() => onAction('verify_public_url')}>{pending('verify_public_url') ? 'Verifying durable route…' : 'Verify durable route'}</button>
			</div>
		</section>
	</section>

			<ActionCard
			eyebrow="1 · Fast Start"
			title="Quick Tunnel"
			description="Start a temporary public route that the extension verifies automatically through /health and authenticated /ready. It may change after restart."
			primaryLabel="Start Quick Tunnel"
			secondaryLabel="Restart Quick Tunnel"
			disabled={actionDisabled('start_quick_tunnel')}
			primaryPending={pending('start_quick_tunnel')}
			secondaryPending={pending('restart_quick_tunnel')}
			primaryDisabledReason={reason('start_quick_tunnel')}
			secondaryDisabledReason={reason('restart_quick_tunnel')}
			onPrimary={() => onAction('start_quick_tunnel')}
			onSecondary={() => onAction('restart_quick_tunnel')}
		/>
		{#if setup.statusMessages.length}
			<section class="warning-strip" aria-label="Setup status messages">
				{#each setup.statusMessages as message}
					<StatusChip label={message} tone="warning" />
				{/each}
			</section>
		{/if}
		<section class="card inline-card">
			<h3>Quick Tunnel lifecycle</h3>
			<p>Stop the temporary route when you switch to a durable URL or no longer need public access.</p>
			<button type="button" class="secondary" disabled={actionDisabled('stop_quick_tunnel')} aria-busy={pending('stop_quick_tunnel')} title={reason('stop_quick_tunnel') ?? undefined} on:click={() => onAction('stop_quick_tunnel')}>{pending('stop_quick_tunnel') ? 'Stop Quick Tunnel…' : 'Stop Quick Tunnel'}</button>
			{#if reason('stop_quick_tunnel')}<p class="disabled-reason">{reason('stop_quick_tunnel')}</p>{/if}
		</section>

		<section class="card stable-card">
			<p class="eyebrow">2 · Stable Setup</p>
			<h2>Durable Public Route URL</h2>
			<p>Use a user-owned HTTPS URL for long-lived routing. The dashboard verifies the root route, then derives the Cursor Extension Base URL ending in /v1.</p>
			<div class="field-row">
				<label for="public-url">Durable Public Route URL</label>
				<input id="public-url" type="url" value={publicUrl} placeholder="https://codex.example.com" on:input={(event) => onPublicUrlInput(event.currentTarget.value)} />
				<button type="button" disabled={verifyPublicUrlDisabled} aria-busy={pending('verify_public_url')} title={reason('verify_public_url') ?? undefined} on:click={() => onAction('verify_public_url')}>{pending('verify_public_url') ? 'Verifying public URL…' : 'Verify public URL'}</button>
				{#if reason('verify_public_url')}<p class="disabled-reason">{reason('verify_public_url')}</p>{/if}
			</div>
			<dl class="setup-facts">
				<div><dt>Local forwarding target</dt><dd>{setup.localTargetUrl ?? 'Runtime target unavailable'}</dd></div>
				<div><dt>{setup.publicRouteUrlLabel}</dt><dd>{setup.publicRouteUrl ?? 'Not verified yet'}</dd></div>
				<div><dt>Cursor Extension Base URL</dt><dd>{setup.cursorExtensionBaseUrl ?? 'Available after route verification'}</dd></div>
			</dl>
			<div class="examples">
				{#each setup.durableExamples as example}
					<details>
						<summary>{example.label}</summary>
						<p>{example.summary}</p>
					</details>
				{/each}
			</div>
		</section>

		<section class="card cursor-card">
			<p class="eyebrow">3 · Cursor Setup</p>
			<h2>Copy setup values</h2>
			<p>API key is copy-only and is never displayed here. Copy the full setup once the public route is verified.</p>
			<div class="actions wrap">
				<button type="button" class="primary" disabled={actionDisabled('copy_full_setup', !setup.canCopyFinalSetup)} aria-busy={pending('copy_full_setup')} title={reason('copy_full_setup', setup.canCopyFinalSetup ? null : 'Verify a Public Route URL before copying final Cursor setup.') ?? undefined} on:click={() => onAction('copy_full_setup')}>{pending('copy_full_setup') ? 'Copying full setup…' : 'Copy full Cursor setup instructions'}</button>
				<button type="button" class="secondary" disabled={actionDisabled('copy_base_url', !setup.canCopyBaseUrl)} aria-busy={pending('copy_base_url')} title={reason('copy_base_url', setup.canCopyBaseUrl ? null : 'Verify a Public Route URL before copying.') ?? undefined} on:click={() => onAction('copy_base_url')}>{pending('copy_base_url') ? 'Copying Base URL…' : 'Copy Base URL'}</button>
				<button type="button" class="secondary" disabled={copyApiKeyDisabled} aria-busy={copyApiKeyPending} title={reason('copy_api_key') ?? undefined} on:click={() => onAction('copy_api_key')}>{copyApiKeyPending ? 'Copying API key…' : 'Copy local API key'}</button>
				<button type="button" class="secondary" disabled={actionDisabled('copy_models')} aria-busy={pending('copy_models')} title={reason('copy_models') ?? undefined} on:click={() => onAction('copy_models')}>{pending('copy_models') ? 'Copying model guidance…' : 'Copy model guidance'}</button>
				<button type="button" class="secondary" disabled={actionDisabled('open_cursor_settings')} aria-busy={pending('open_cursor_settings')} title={reason('open_cursor_settings') ?? undefined} on:click={() => onAction('open_cursor_settings')}>{pending('open_cursor_settings') ? 'Opening Cursor settings…' : 'Open Cursor settings'}</button>
				<button type="button" class="secondary" disabled={actionDisabled('mark_cursor_confirmed')} aria-busy={pending('mark_cursor_confirmed')} title={reason('mark_cursor_confirmed') ?? undefined} on:click={() => onAction('mark_cursor_confirmed')}>{pending('mark_cursor_confirmed') ? 'Confirming Cursor…' : 'Mark Cursor confirmed'}</button>
			</div>
			{#if reason('copy_api_key') || reason('copy_full_setup', setup.canCopyFinalSetup ? null : 'Verify a Public Route URL before copying final Cursor setup.')}
				<p class="disabled-reason">{reason('copy_api_key') ?? reason('copy_full_setup', setup.canCopyFinalSetup ? null : 'Verify a Public Route URL before copying final Cursor setup.')}</p>
			{/if}
		</section>

		<div class="security-grid">
			<DangerAction
				title="Rotate local API key"
				description="Rotating invalidates the old key and requires updating Cursor settings."
				buttonLabel="Rotate local API key"
				confirmText="The old Cursor API key will stop working. Update Cursor settings with the new key, reverify the public route, and send a new Cursor request. Codex OAuth tokens are not affected."
				pending={pending('rotate_local_api_key')}
				disabled={actionDisabled('rotate_local_api_key')}
				disabledReason={reason('rotate_local_api_key')}
				onConfirm={() => onAction('rotate_local_api_key')}
			/>
			<section class="card">
				<p class="eyebrow">4 · Security / Repair</p>
				<h2>OpenAI-key repair</h2>
				<p>{setup.openAiKeyRepair.summary}</p>
				{#if openAiRepairUnavailable}
					<StatusChip label="Unavailable on this host / not required for Ready" tone="warning" />
				{:else}
					<ChoiceGroup
						label="OpenAI-key repair"
						options={openAiRepairOptions}
						selectedValue={selectedOpenAiRepairValue}
						pendingValue={setup.pendingOpenAiKeyRepairDecision}
						pending={pending('set_openai_key_repair_decision')}
						disabled={actionDisabled('set_openai_key_repair_decision')}
						disabledReason={reason('set_openai_key_repair_decision') ?? setup.openAiKeyRepair.disabledReason}
						pendingLabel="Updating repair…"
						onSelect={selectOpenAiRepair}
					/>
				{/if}
			</section>
		</div>
	</div>
</section>
