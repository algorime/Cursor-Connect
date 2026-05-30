import { describe, expect, it } from 'vitest';

import { InMemoryExtensionStateStore } from '../src/settings/model-routing.js';
import { OpenAiKeyRepairController } from '../src/setup/openai-key-repair.js';

describe('OpenAiKeyRepairController', () => {
	it('degrades explicitly when the private Cursor capability is unavailable', async () => {
		const controller = new OpenAiKeyRepairController({
			state: new InMemoryExtensionStateStore(),
			detectCapability: async () => ({ available: false, reason: 'not_found' })
		});

		expect(await controller.getStatus()).toEqual({ decision: 'decide_later', capability: 'unavailable', reason: 'not_found' });
	});

	it('stores user decisions separately from stable setup actions', async () => {
		const store = new InMemoryExtensionStateStore();
		const controller = new OpenAiKeyRepairController({
			state: store,
			detectCapability: async () => ({ available: true })
		});

		await controller.setDecision('skipped');

		expect(await controller.getStatus()).toEqual({ decision: 'skipped', capability: 'available' });
	});

	it('supports enable, decide later, and disable decisions when capability is available', async () => {
		const controller = new OpenAiKeyRepairController({
			state: new InMemoryExtensionStateStore(),
			detectCapability: async () => ({ available: true })
		});

		await controller.setDecision('enabled');
		expect(await controller.getStatus()).toEqual({ decision: 'enabled', capability: 'available' });

		await controller.setDecision('decide_later');
		expect(await controller.getStatus()).toEqual({ decision: 'decide_later', capability: 'available' });

		await controller.setDecision('disabled');
		expect(await controller.getStatus()).toEqual({ decision: 'disabled', capability: 'available' });
	});
});
