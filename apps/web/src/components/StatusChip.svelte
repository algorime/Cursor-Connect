<script lang="ts">
	export let label: string;
	export let tone: 'default' | 'success' | 'warning' | 'danger' = 'default';
</script>

<span class={`chip chip-${tone}`}>{label}</span>
