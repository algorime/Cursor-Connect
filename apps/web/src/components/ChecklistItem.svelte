<script lang="ts">
	import type { SetupChecklistItem } from '@codex-auth-ext/shared';
	export let item: SetupChecklistItem;
</script>

<li class={`check-item check-${item.status}`}>
	<div>
		<strong>{item.label}</strong>
		<span>{item.status}</span>
	</div>
	<p>{item.guidance}</p>
</li>
