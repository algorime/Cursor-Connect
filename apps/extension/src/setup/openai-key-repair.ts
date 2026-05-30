import type { OpenAiKeyRepairDecision, OpenAiKeyRepairStatus } from '@codex-auth-ext/shared';
import type { ExtensionStateStore } from '../settings/model-routing.js';

export type OpenAiKeyRepairCapability = { available: true } | { available: false; reason: string };

const KEY = 'codexAuthExt.setup.openAiKeyRepairDecision';

export class OpenAiKeyRepairController {
	constructor(private readonly options: {
		state: ExtensionStateStore;
		detectCapability?: () => Promise<OpenAiKeyRepairCapability>;
	}) {}

	async getStatus(): Promise<OpenAiKeyRepairStatus> {
		const decision = this.options.state.get<OpenAiKeyRepairDecision>(KEY) ?? 'decide_later';
		const capability = await (this.options.detectCapability ?? defaultCapabilityDetector)();
		return capability.available
			? { decision, capability: 'available' }
			: { decision, capability: 'unavailable', reason: capability.reason };
	}

	async setDecision(decision: OpenAiKeyRepairDecision): Promise<void> {
		await this.options.state.update(KEY, decision);
	}
}

async function defaultCapabilityDetector(): Promise<OpenAiKeyRepairCapability> {
	return { available: false, reason: 'not_found' };
}
