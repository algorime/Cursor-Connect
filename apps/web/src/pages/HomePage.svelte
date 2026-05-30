<script lang="ts">
	import ActionCard from '../components/ActionCard.svelte';
	import ChecklistItem from '../components/ChecklistItem.svelte';
	import ReadinessCard from '../components/ReadinessCard.svelte';
	import StatusChip from '../components/StatusChip.svelte';
	import type { DashboardActionId, DashboardHomeViewModel } from '../dashboard-state.js';
	import {
		createDashboardInteractionState,
		disabledReasonFor,
		isActionDisabled,
		isActionPending,
		type DashboardActionKey,
		type DashboardInteractionState
	} from '../interaction-state.js';

	export let home: DashboardHomeViewModel;
	export let interactionState: DashboardInteractionState = createDashboardInteractionState();
	export let secondaryLabel: string | null = null;
	export let primaryPending = false;
	export let secondaryPending = false;
	export let primaryDisabled = false;
	export let secondaryDisabled = false;
	export let primaryDisabledReason: string | null = null;
	export let secondaryDisabledReason: string | null = null;
	export let onAction: (id: string) => void = () => undefined;

	function toInteractionAction(id: DashboardActionId): DashboardActionKey | null {
		switch (id) {
			case 'sign_in_codex':
			case 'import_codex_auth':
			case 'recheck_auth':
			case 'start_quick_tunnel':
			case 'stop_quick_tunnel':
			case 'restart_quick_tunnel':
			case 'verify_public_url':
			case 'copy_full_setup':
			case 'copy_base_url':
			case 'open_cursor_settings':
			case 'mark_cursor_confirmed':
			case 'run_doctor':
				return id;
			default:
				return null;
		}
	}

	function pending(id: DashboardActionId): boolean {
		const action = toInteractionAction(id);
		return action ? isActionPending(interactionState, action) : false;
	}

	function disabled(id: DashboardActionId, baseDisabled = false): boolean {
		const action = toInteractionAction(id);
		return action ? isActionDisabled(interactionState, action, baseDisabled) : baseDisabled;
	}

	function disabledReason(id: DashboardActionId, baseReason: string | null = null): string | null {
		const action = toInteractionAction(id);
		return action ? disabledReasonFor(interactionState, action, baseReason) : baseReason;
	}
</script>

<section class="page home-page">
	<header class={`hero hero-${home.mode}`}>
		<div>
			<p class="eyebrow">Codex Auth-First</p>
			<h1>{home.headline}</h1>
			<p>{home.blockingItem?.guidance ?? home.nextAction.description}</p>
		</div>
		<div class="hero-chips">
			{#each home.badges as badge}
				<StatusChip label={badge} tone={badge.includes('Temporary') ? 'warning' : badge.includes('verified') ? 'success' : 'default'} />
			{/each}
		</div>
	</header>

	<section class="command-center" aria-label="Codex auth and public route status">
		<section class={`card command-card command-${home.commandCenter.auth.status}`}>
			<p class="eyebrow">Codex Auth</p>
			<h2>{home.commandCenter.auth.title}</h2>
			<p>{home.commandCenter.auth.summary}</p>
			<dl class="setup-facts">
				{#each home.commandCenter.auth.facts as fact}
					<div><dt>{fact.label}</dt><dd class={`fact-${fact.tone ?? 'default'}`}>{fact.value}</dd></div>
				{/each}
			</dl>
			<div class="actions wrap">
				<button type="button" class="primary" disabled={disabled(home.commandCenter.auth.primaryAction)} aria-busy={pending(home.commandCenter.auth.primaryAction)} title={disabledReason(home.commandCenter.auth.primaryAction) ?? undefined} on:click={() => onAction(home.commandCenter.auth.primaryAction)}>{pending(home.commandCenter.auth.primaryAction) ? `${home.commandCenter.auth.primaryLabel}…` : home.commandCenter.auth.primaryLabel}</button>
				<button type="button" class="secondary" disabled={disabled(home.commandCenter.auth.secondaryAction)} aria-busy={pending(home.commandCenter.auth.secondaryAction)} title={disabledReason(home.commandCenter.auth.secondaryAction) ?? undefined} on:click={() => onAction(home.commandCenter.auth.secondaryAction)}>{pending(home.commandCenter.auth.secondaryAction) ? `${home.commandCenter.auth.secondaryLabel}…` : home.commandCenter.auth.secondaryLabel}</button>
				{#if home.commandCenter.auth.status !== 'complete'}
					<button type="button" class="secondary" disabled={disabled(home.commandCenter.auth.recheckAction)} aria-busy={pending(home.commandCenter.auth.recheckAction)} title={disabledReason(home.commandCenter.auth.recheckAction) ?? undefined} on:click={() => onAction(home.commandCenter.auth.recheckAction)}>Recheck auth</button>
				{/if}
			</div>
		</section>

		<section class={`card command-card route-${home.commandCenter.route.status}`}>
			<p class="eyebrow">Public Route / Tunnel</p>
			<h2>{home.commandCenter.route.title}</h2>
			<p>{home.commandCenter.route.summary}</p>
			<dl class="setup-facts route-facts">
				{#each home.commandCenter.route.facts as fact}
					<div><dt>{fact.label}</dt><dd class={`fact-${fact.tone ?? 'default'}`}>{fact.value}</dd></div>
				{/each}
			</dl>
			<div class="actions wrap">
				<button type="button" class="primary" disabled={disabled(home.commandCenter.route.primaryAction, home.commandCenter.route.primaryAction === 'copy_base_url' && !home.commandCenter.route.canCopyBaseUrl)} aria-busy={pending(home.commandCenter.route.primaryAction)} title={disabledReason(home.commandCenter.route.primaryAction) ?? undefined} on:click={() => onAction(home.commandCenter.route.primaryAction)}>{pending(home.commandCenter.route.primaryAction) ? `${home.commandCenter.route.primaryLabel}…` : home.commandCenter.route.primaryLabel}</button>
				<button type="button" class="secondary" disabled={disabled(home.commandCenter.route.secondaryAction)} aria-busy={pending(home.commandCenter.route.secondaryAction)} title={disabledReason(home.commandCenter.route.secondaryAction) ?? undefined} on:click={() => onAction(home.commandCenter.route.secondaryAction)}>{pending(home.commandCenter.route.secondaryAction) ? `${home.commandCenter.route.secondaryLabel}…` : home.commandCenter.route.secondaryLabel}</button>
			</div>
		</section>
	</section>

	<div class="home-grid">
		<ActionCard
			eyebrow="Next action"
			title={home.nextAction.label}
			description={home.nextAction.description}
			primaryLabel={home.nextAction.primary === 'none' ? 'No action needed' : home.nextAction.label}
			secondaryLabel={secondaryLabel}
			disabled={primaryDisabled}
			{primaryPending}
			{secondaryPending}
			primaryDisabledReason={primaryDisabledReason}
			secondaryDisabledReason={secondaryDisabled ? secondaryDisabledReason : null}
			onPrimary={() => onAction(home.nextAction.primary)}
			onSecondary={() => home.nextAction.secondary && onAction(home.nextAction.secondary)}
		/>

		<section class="card facts-card">
			<p class="eyebrow">Current setup facts</p>
			{#if home.facts.length}
				<dl>
					{#each home.facts as fact}
						<div>
							<dt>{fact.label}</dt>
							<dd class={`fact-${fact.tone ?? 'default'}`}>{fact.value}</dd>
						</div>
					{/each}
				</dl>
			{:else}
				<p>No public route is verified yet. Fast Start can create a temporary route.</p>
			{/if}
		</section>
	</div>

	{#if home.warningChips.length}
		<section class="warning-strip" aria-label="Setup warnings">
			{#each home.warningChips as warning}
				<StatusChip label={warning} tone="warning" />
			{/each}
		</section>
	{/if}

	<section class="card">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Readiness</p>
				<h2>Setup gates</h2>
			</div>
		</div>
		<div class="readiness-grid">
			{#each home.readinessCards as card}
				<ReadinessCard label={card.label} status={card.status} guidance={card.guidance} />
			{/each}
		</div>
	</section>

	<section class="card compact-checklist">
		<p class="eyebrow">Detailed checklist</p>
		<ul>
			{#each home.items as item}
				<ChecklistItem {item} />
			{/each}
		</ul>
	</section>
</section>
