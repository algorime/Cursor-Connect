<script lang="ts">
	import ActivityDock from './ActivityDock.svelte';
	import SidebarNav from './SidebarNav.svelte';
	import type { DashboardNavItem, DashboardPageId } from '../dashboard-state.js';
	import type { GlobalActivity } from '../interaction-state.js';
	export let nav: DashboardNavItem[] = [];
	export let activePage: DashboardPageId = 'home';
	export let actionMessage: string | null = null;
	export let activity: GlobalActivity = { kind: 'idle', message: '' };
	export let onSelect: (page: DashboardPageId) => void = () => undefined;
</script>

<div class="dashboard-shell">
	<SidebarNav items={nav} {activePage} {onSelect} />
	<main class="content-shell">
		<ActivityDock {activity} {actionMessage} />
		<slot />
	</main>
</div>
