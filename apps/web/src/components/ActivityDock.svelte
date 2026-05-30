<script lang="ts">
	import type { GlobalActivity } from '../interaction-state.js';

	export let activity: GlobalActivity = { kind: 'idle', message: '' };
	export let actionMessage: string | null = null;

	$: visible = activity.kind !== 'idle' || !!actionMessage;
	$: role = activity.kind === 'error' ? 'alert' : 'status';
	$: message = activity.kind !== 'idle' ? activity.message : actionMessage;
	$: recovery = activity.kind !== 'idle' ? activity.recovery : null;
</script>

{#if visible && message}
	<section class={`activity-dock activity-${activity.kind}`} {role} aria-live="polite" aria-label="Dashboard activity">
		<span class="activity-dot" aria-hidden="true"></span>
		<div>
			<strong>{message}</strong>
			{#if recovery}<p>{recovery}</p>{/if}
		</div>
	</section>
{/if}
