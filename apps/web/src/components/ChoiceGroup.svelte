<script lang="ts">
	export interface ChoiceOption {
		value: string;
		label: string;
		description: string;
	}

	export let label: string;
	export let options: ChoiceOption[] = [];
	export let selectedValue: string | null = null;
	export let pendingValue: string | null = null;
	export let pending = false;
	export let disabled = false;
	export let disabledReason: string | null = null;
	export let pendingLabel = 'Updating…';
	export let onSelect: (value: string) => void = () => undefined;
</script>

<div class="choice-group" role="radiogroup" aria-label={label}>
	{#each options as option}
		{@const selected = option.value === selectedValue}
		{@const optionPending = option.value === pendingValue}
		<button
			type="button"
			class="choice-card"
			class:choice-selected={selected}
			disabled={disabled || pending}
			role="radio"
			aria-checked={selected}
			aria-busy={optionPending}
			title={disabledReason ?? undefined}
			on:click={() => onSelect(option.value)}
		>
			<span class="choice-check" aria-hidden="true">{selected ? '✓' : ''}</span>
			<span class="choice-copy">
				<strong>{option.label}</strong>
				<small>{optionPending ? pendingLabel : option.description}</small>
			</span>
			{#if selected}
				<span class="choice-badge">Selected</span>
			{/if}
		</button>
	{/each}
</div>
