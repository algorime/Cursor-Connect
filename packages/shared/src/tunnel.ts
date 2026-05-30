export type QuickTunnelState = 'not_started' | 'starting' | 'running' | 'stopped' | 'exited' | 'error' | 'unsupported';

export interface QuickTunnelStatus {
	kind: 'quick_tunnel';
	state: QuickTunnelState;
	url: string | null;
	temporary: true;
	streamingUnsupportedOrUnverified: true;
	message?: string | null;
}

export function createQuickTunnelStatus(
	state: QuickTunnelState,
	url: string | null = null,
	message: string | null = null
): QuickTunnelStatus {
	return {
		kind: 'quick_tunnel',
		state,
		url,
		temporary: true,
		streamingUnsupportedOrUnverified: true,
		message
	};
}
