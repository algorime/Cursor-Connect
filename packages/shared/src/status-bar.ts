export type StatusBarPreference = 'visible' | 'hidden';

export interface StatusBarStateInput {
	preference: StatusBarPreference;
	ready: boolean;
	tunnelRunning: boolean;
	authReady?: boolean;
	routeReady?: boolean;
	routeStale?: boolean;
	temporaryRoute?: boolean;
	hasError?: boolean;
	limited?: boolean;
}

export interface StatusBarViewModel {
	visible: boolean;
	text: 'Codex' | 'Codex: Setup' | 'Codex: Auth' | 'Codex: Route' | 'Codex: Ready' | 'Codex: Limited' | 'Codex: Error' | 'Codex: Tunnel';
	tooltip: string;
}

export function buildStatusBarViewModel(input: StatusBarStateInput): StatusBarViewModel {
	if (input.preference === 'hidden') {
		return {
			visible: false,
			text: 'Codex',
			tooltip: 'Codex status hidden'
		};
	}

	if (input.hasError) {
		return { visible: true, text: 'Codex: Error', tooltip: 'Codex setup needs repair' };
	}

	if (input.limited) {
		return { visible: true, text: 'Codex: Limited', tooltip: 'Codex account may be limited' };
	}

	if (!input.ready && input.authReady === false) {
		return { visible: true, text: 'Codex: Auth', tooltip: 'Codex authentication is needed before Cursor setup can be ready' };
	}

	if (!input.ready && input.routeStale) {
		return { visible: true, text: 'Codex: Route', tooltip: 'Public route is stale or points at a different extension runtime' };
	}

	if (input.ready) {
		return {
			visible: true,
			text: 'Codex: Ready',
			tooltip: input.temporaryRoute
				? 'Codex setup is ready; current Extension Base URL is a temporary Quick Tunnel and may change.'
				: 'Codex setup is ready'
		};
	}

	if (input.tunnelRunning) {
		return { visible: true, text: 'Codex: Tunnel', tooltip: 'Codex route uses a temporary tunnel' };
	}

	if (input.routeReady === false) {
		return { visible: true, text: 'Codex: Route', tooltip: 'Start Quick Tunnel or verify a public Extension Base URL' };
	}

	return { visible: true, text: 'Codex: Setup', tooltip: 'Codex setup is not complete' };
}
