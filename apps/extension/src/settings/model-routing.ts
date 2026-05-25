export interface ExtensionStateStore {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown): Promise<void>;
}

const ROUTING_WORKAROUND_KEY = 'codexAuthExt.routing.gpt54ToGpt55WorkaroundEnabled';

export class ModelRoutingSettingsStore {
	constructor(private readonly state: ExtensionStateStore) {}

	getGpt54ToGpt55WorkaroundEnabled(): boolean {
		return this.state.get<boolean>(ROUTING_WORKAROUND_KEY) ?? false;
	}

	async setGpt54ToGpt55WorkaroundEnabled(enabled: boolean): Promise<void> {
		await this.state.update(ROUTING_WORKAROUND_KEY, enabled);
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
