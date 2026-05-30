<script lang="ts">
	export let eyebrow = '';
	export let title: string;
	export let description: string;
	export let primaryLabel: string;
	export let secondaryLabel: string | null = null;
	export let disabled = false;
	export let primaryPending = false;
	export let secondaryPending = false;
	export let primaryDisabledReason: string | null = null;
	export let secondaryDisabledReason: string | null = null;
	export let onPrimary: () => void = () => undefined;
	export let onSecondary: () => void = () => undefined;
</script>

<section class="card action-card" class:pending-card={primaryPending || secondaryPending} aria-busy={primaryPending || secondaryPending}>
	{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
	<h3>{title}</h3>
	<p>{description}</p>
	<div class="actions">
		<button type="button" class="primary" disabled={disabled || primaryPending} aria-busy={primaryPending} title={primaryDisabledReason ?? undefined} on:click={onPrimary}>{primaryPending ? `${primaryLabel}…` : primaryLabel}</button>
		{#if secondaryLabel}
			<button type="button" class="secondary" disabled={secondaryPending || !!secondaryDisabledReason} aria-busy={secondaryPending} title={secondaryDisabledReason ?? undefined} on:click={onSecondary}>{secondaryPending ? `${secondaryLabel}…` : secondaryLabel}</button>
		{/if}
	</div>
	{#if primaryDisabledReason || secondaryDisabledReason}
		<p class="disabled-reason">{primaryDisabledReason ?? secondaryDisabledReason}</p>
	{/if}
</section>
