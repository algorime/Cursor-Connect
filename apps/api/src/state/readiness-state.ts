import { createEmptyApiTrafficStatus, recordCursorFacingTraffic } from '@codex-auth-ext/shared';
import type {
	ApiTrafficStatus,
	CodexAuthState,
	InternalStatusResponse,
	ModelPolicyState,
	ProxyState
} from '@codex-auth-ext/shared';

export class ReadinessState {
	private controlConfigured: boolean;
	private controlAuthenticated = false;
	private authHandoffConnected = false;
	private authHandoffLeaseExpiresAt = 0;
	private codexAuthState: CodexAuthState = 'not_configured';
	private modelPolicyState: ModelPolicyState = 'workaround_disabled';
	private proxyState: ProxyState = 'auth_not_ready';
	private usageStorageState: 'ready' | 'degraded' = 'ready';
	private traffic: ApiTrafficStatus = createEmptyApiTrafficStatus();
	private readonly runtimeId: string | undefined;
	private readonly now: () => number;
	private readonly authHandoffLeaseMs: number;

	constructor(
		controlConfigured: boolean,
		options: { now?: () => number; authHandoffLeaseMs?: number; runtimeId?: string }
	) {
		this.controlConfigured = controlConfigured;
		this.runtimeId = options.runtimeId;
		this.now = options.now ?? Date.now;
		this.authHandoffLeaseMs = options.authHandoffLeaseMs ?? 5_000;
	}

	markControlAuthenticated(): void {
		if (this.controlConfigured) {
			this.controlAuthenticated = true;
		}
	}

	markAuthHandoffConnected(connected = true): void {
		this.authHandoffConnected = connected;
		this.authHandoffLeaseExpiresAt = connected ? this.now() + this.authHandoffLeaseMs : 0;
		this.recomputeProxyState();
	}

	setCodexAuthState(state: CodexAuthState): void {
		this.codexAuthState = state;
		this.recomputeProxyState();
	}

	setModelPolicyState(state: ModelPolicyState): void {
		this.modelPolicyState = state;
		this.recomputeProxyState();
	}

	setUsageStorageState(state: 'ready' | 'degraded'): void {
		this.usageStorageState = state;
		this.recomputeProxyState();
	}

	isReady(): boolean {
		this.recomputeProxyState();
		return (
			this.controlConfigured &&
			this.controlAuthenticated &&
			this.authHandoffConnected &&
			this.codexAuthState === 'authenticated' &&
			(this.modelPolicyState === 'ready' ||
				this.modelPolicyState === 'workaround_enabled' ||
				this.modelPolicyState === 'workaround_disabled') &&
			this.proxyState === 'proxy_ready'
		);
	}

	isControlConfigured(): boolean {
		return this.controlConfigured;
	}

	isControlAuthenticated(): boolean {
		return this.controlAuthenticated;
	}

	recordCursorFacingRequest(method: string, path: string): void {
		this.traffic = recordCursorFacingTraffic(this.traffic, {
			method,
			path,
			at: this.now()
		});
	}

	getInternalStatus(): InternalStatusResponse {
		this.recomputeProxyState();
		return {
			runtimeId: this.runtimeId,
			traffic: structuredClone(this.traffic),
			controlConfigured: this.controlConfigured,
			controlAuthenticated: this.controlAuthenticated,
			authHandoffConnected: this.authHandoffConnected,
			codexAuthState: this.codexAuthState,
			modelPolicyState: this.modelPolicyState,
			proxyState: this.proxyState,
			usageStorageState: this.usageStorageState
		};
	}

	private recomputeProxyState(): void {
		if (this.authHandoffConnected && this.now() > this.authHandoffLeaseExpiresAt) {
			this.authHandoffConnected = false;
			this.authHandoffLeaseExpiresAt = 0;
		}

		if (!this.controlAuthenticated || !this.authHandoffConnected) {
			this.proxyState = 'control_disconnected';
			return;
		}

		if (this.codexAuthState !== 'authenticated') {
			this.proxyState = 'auth_not_ready';
			return;
		}

		if (
			this.modelPolicyState === 'routing_not_verified' ||
			this.modelPolicyState === 'protocol_shape_changed'
		) {
			this.proxyState = 'protocol_unavailable';
			return;
		}

		this.proxyState = 'proxy_ready';
	}
}
