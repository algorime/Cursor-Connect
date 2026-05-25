import type {
	CodexAuthState,
	InternalStatusResponse,
	ModelPolicyState,
	ProxyState
} from '@codex-auth-ext/shared';

export class ReadinessState {
	private controlConfigured: boolean;
	private controlAuthenticated = false;
	private authHandoffConnected = false;
	private codexAuthState: CodexAuthState = 'not_configured';
	private modelPolicyState: ModelPolicyState = 'workaround_disabled';
	private proxyState: ProxyState = 'auth_not_ready';

	constructor(controlConfigured: boolean) {
		this.controlConfigured = controlConfigured;
	}

	markControlAuthenticated(): void {
		if (this.controlConfigured) {
			this.controlAuthenticated = true;
		}
	}

	markAuthHandoffConnected(connected = true): void {
		this.authHandoffConnected = connected;
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

	isReady(): boolean {
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

	getInternalStatus(): InternalStatusResponse {
		return {
			controlConfigured: this.controlConfigured,
			controlAuthenticated: this.controlAuthenticated,
			authHandoffConnected: this.authHandoffConnected,
			codexAuthState: this.codexAuthState,
			modelPolicyState: this.modelPolicyState,
			proxyState: this.proxyState
		};
	}

	private recomputeProxyState(): void {
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
