export class ReadinessState {
	private controlConfigured: boolean;
	private controlAuthenticated = false;

	constructor(controlConfigured: boolean) {
		this.controlConfigured = controlConfigured;
	}

	markControlAuthenticated(): void {
		if (this.controlConfigured) {
			this.controlAuthenticated = true;
		}
	}

	isReady(): boolean {
		return this.controlConfigured && this.controlAuthenticated;
	}

	isControlConfigured(): boolean {
		return this.controlConfigured;
	}

	isControlAuthenticated(): boolean {
		return this.controlAuthenticated;
	}
}
