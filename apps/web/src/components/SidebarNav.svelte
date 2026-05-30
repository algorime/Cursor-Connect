<script lang="ts">
	import type { DashboardNavItem, DashboardPageId } from '../dashboard-state.js';
	export let items: DashboardNavItem[] = [];
	export let activePage: DashboardPageId = 'home';
	export let onSelect: (page: DashboardPageId) => void = () => undefined;
</script>

<nav class="sidebar" aria-label="Dashboard sections">
	<div class="brand">
		<span class="brand-mark">C</span>
		<div>
			<strong>Codex Auth</strong>
			<small>Dashboard</small>
		</div>
	</div>
	<ul>
		{#each items as item}
			<li>
				<button
					type="button"
					class:active={item.id === activePage}
					class:disabled={item.disabled}
					disabled={item.disabled}
					on:click={() => !item.disabled && onSelect(item.id)}
				>
					<span>{item.label}</span>
					{#if item.badge}<em>{item.badge}</em>{/if}
				</button>
			</li>
		{/each}
	</ul>
</nav>
