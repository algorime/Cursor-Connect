import { buildStatusBarViewModel, type StatusBarPreference, type StatusBarViewModel } from '@codex-auth-ext/shared';

export interface ExtensionStatusInput {
	preference: StatusBarPreference;
	setupReady: boolean;
	tunnelRunning: boolean;
	authReady?: boolean;
	routeReady?: boolean;
	routeStale?: boolean;
	temporaryRoute?: boolean;
	hasError?: boolean;
	limited?: boolean;
}

export function buildExtensionStatusBarViewModel(input: ExtensionStatusInput): StatusBarViewModel {
	return buildStatusBarViewModel({
		preference: input.preference,
		ready: input.setupReady,
		tunnelRunning: input.tunnelRunning,
		authReady: input.authReady,
		routeReady: input.routeReady,
		routeStale: input.routeStale,
		temporaryRoute: input.temporaryRoute,
		hasError: input.hasError,
		limited: input.limited
	});
}
