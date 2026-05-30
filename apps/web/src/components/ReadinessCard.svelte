<script lang="ts">
	import type { SetupChecklistItem } from '@codex-auth-ext/shared';
	export let label: string;
	export let status: SetupChecklistItem['status'];
	export let guidance: string;
</script>

<article class={`card readiness readiness-${status}`}>
	<div>
		<span class="status-dot" aria-hidden="true"></span>
		<strong>{label}</strong>
	</div>
	<span class="status-label">{status}</span>
	<p>{guidance}</p>
</article>
