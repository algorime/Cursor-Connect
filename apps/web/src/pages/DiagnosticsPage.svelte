<script lang="ts">
	import type { DiagnosticsViewModel } from '../dashboard-state.js';
	import { createDashboardInteractionState, disabledReasonFor, isActionDisabled, isActionPending, type DashboardInteractionState } from '../interaction-state.js';
	export let diagnostics: DiagnosticsViewModel | null = null;
	export let interactionState: DashboardInteractionState = createDashboardInteractionState();
	export let onRunDoctor: () => void = () => undefined;

	const statuses: Array<keyof DiagnosticsViewModel['groups']> = ['fail', 'warn', 'pass'];
	$: doctorPending = isActionPending(interactionState, 'run_doctor');
	$: doctorDisabled = isActionDisabled(interactionState, 'run_doctor');
	$: doctorReason = disabledReasonFor(interactionState, 'run_doctor');
</script>

<section class="page diagnostics-page">
	<header class="page-header split">
		<div>
			<p class="eyebrow">Diagnostics</p>
			<h1>Doctor checks</h1>
			<p>Grouped safe checks. Details are collapsed and redacted by the extension.</p>
		</div>
		<button type="button" class="primary" disabled={doctorDisabled} aria-busy={doctorPending} title={doctorReason ?? undefined} on:click={onRunDoctor}>{doctorPending ? 'Running doctor…' : 'Run doctor'}</button>
	</header>
	{#if doctorReason}<p class="disabled-reason">{doctorReason}</p>{/if}

	{#if diagnostics}
		<div class="diagnostic-groups">
			{#each statuses as status}
				<section class="card diagnostic-group">
					<h2>{status.toUpperCase()}</h2>
					{#if diagnostics.groups[status].length}
						{#each diagnostics.groups[status] as check}
							<article class={`doctor-card doctor-${check.status}`}>
								<strong>{check.label}</strong>
								<p>{check.guidance}</p>
								{#if check.details}
									<details><summary>Safe details</summary><pre>{JSON.stringify(check.details, null, 2)}</pre></details>
								{/if}
							</article>
						{/each}
					{:else}
						<p>No {status} checks.</p>
					{/if}
				</section>
			{/each}
		</div>
	{:else}
		<section class="card empty-state">
			<h2>No doctor report yet</h2>
			<p>Run doctor to inspect local runtime, public route, auth, Quick Tunnel, preferences, and repair state.</p>
		</section>
	{/if}
</section>
