<script lang="ts">
	export let title: string;
	export let description: string;
	export let buttonLabel: string;
	export let confirmText = 'This changes Cursor setup values. Continue?';
	export let pending = false;
	export let disabled = false;
	export let disabledReason: string | null = null;
	export let onConfirm: () => void = () => undefined;

	let confirming = false;

	$: if (pending || disabled) {
		confirming = false;
	}

	function handleClick(): void {
		if (!disabled && !pending) {
			confirming = true;
		}
	}

	function confirm(): void {
		if (!disabled && !pending) {
			confirming = false;
			onConfirm();
		}
	}

	function cancel(): void {
		confirming = false;
	}
</script>

<section class="card danger-card" class:pending-card={pending} aria-busy={pending}>
	<h3>{title}</h3>
	<p>{description}</p>
	<button type="button" class="danger" disabled={disabled || pending} aria-busy={pending} title={disabledReason ?? undefined} on:click={handleClick}>{pending ? `${buttonLabel}…` : buttonLabel}</button>
	{#if confirming}
		<div class="danger-confirm" role="alert" aria-live="assertive">
			<p>{confirmText}</p>
			<div class="actions wrap">
				<button type="button" class="danger" disabled={disabled || pending} on:click={confirm}>Confirm {buttonLabel}</button>
				<button type="button" class="secondary" disabled={pending} on:click={cancel}>Cancel</button>
			</div>
		</div>
	{/if}
	{#if disabledReason}<p class="disabled-reason">{disabledReason}</p>{/if}
</section>
