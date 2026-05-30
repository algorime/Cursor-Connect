import type { ModelWorkaroundDecision } from '@codex-auth-ext/shared';

export interface ExtensionStateStore {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown): Promise<void>;
}

const ROUTING_WORKAROUND_KEY = 'codexAuthExt.routing.gpt54ToGpt55WorkaroundEnabled';
const ROUTING_WORKAROUND_DECISION_KEY = 'codexAuthExt.routing.gpt54ToGpt55WorkaroundDecision';
const ROUTING_WORKAROUND_RUNTIME_ENABLED = false;

export class ModelRoutingSettingsStore {
	constructor(private readonly state: ExtensionStateStore) {}

	getGpt54ToGpt55WorkaroundDecision(): ModelWorkaroundDecision {
		if (!ROUTING_WORKAROUND_RUNTIME_ENABLED) {
			return 'skipped';
		}
		const decision = this.state.get<ModelWorkaroundDecision>(ROUTING_WORKAROUND_DECISION_KEY);
		if (decision) {
			return decision;
		}
		return this.state.get<boolean>(ROUTING_WORKAROUND_KEY) ? 'enabled' : 'decide_later';
	}

	async setGpt54ToGpt55WorkaroundDecision(decision: ModelWorkaroundDecision): Promise<void> {
		await this.state.update(ROUTING_WORKAROUND_DECISION_KEY, decision);
		await this.state.update(ROUTING_WORKAROUND_KEY, decision === 'enabled');
	}

	getGpt54ToGpt55WorkaroundEnabled(): boolean {
		return ROUTING_WORKAROUND_RUNTIME_ENABLED && this.getGpt54ToGpt55WorkaroundDecision() === 'enabled';
	}

	async setGpt54ToGpt55WorkaroundEnabled(enabled: boolean): Promise<void> {
		await this.setGpt54ToGpt55WorkaroundDecision(enabled ? 'enabled' : 'skipped');
	}
}

export class InMemoryExtensionStateStore implements ExtensionStateStore {
	private readonly values = new Map<string, unknown>();

	get<T>(key: string): T | undefined {
		return this.values.get(key) as T | undefined;
	}

	async update(key: string, value: unknown): Promise<void> {
		this.values.set(key, value);
	}
}

export function createVsCodeStateStore(state: {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown): Thenable<void>;
}): ExtensionStateStore {
	return {
		get<T>(key: string): T | undefined {
			return state.get<T>(key);
		},
		async update(key: string, value: unknown): Promise<void> {
			await state.update(key, value);
		}
	};
}
