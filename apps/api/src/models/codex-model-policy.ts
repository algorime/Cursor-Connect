import type {
	CodexModelEntry,
	CursorFacingModelId,
	ModelPolicyState,
	UpstreamModelId
} from '@codex-auth-ext/shared';

export interface ModelRoutingSettings {
	gpt54ToGpt55WorkaroundEnabled: boolean;
	supportedModelIds?: string[];
	modelRewrites?: Record<string, string>;
}

export interface ResolvedModelRoute {
	cursorFacingModelId: CursorFacingModelId;
	upstreamModelId: UpstreamModelId;
	policyState: ModelPolicyState;
}

export function listSupportedModels(settings: ModelRoutingSettings): CodexModelEntry[] {
	const supportedModelIds = settings.supportedModelIds?.length
		? settings.supportedModelIds
		: ['gpt-5.4', 'gpt-5.4-mini'];
	const models = supportedModelIds.map((modelId) => resolveModelRoute(modelId, settings));

	if (models.some((model) => !model)) {
		throw new Error('built-in Codex model policy is misconfigured');
	}

	return models.map((route) => ({
		id: route?.cursorFacingModelId ?? '',
		object: 'model',
		owned_by: 'codex-auth-first',
		upstreamModelId: route?.upstreamModelId ?? '',
		supported: true,
		recommended: route?.cursorFacingModelId === 'gpt-5.4',
		workaroundRequired: route?.cursorFacingModelId === 'gpt-5.4',
		policyState: route?.policyState ?? 'protocol_shape_changed'
	}));
}

export function resolveModelRoute(
	model: string,
	settings: ModelRoutingSettings
): ResolvedModelRoute | null {
	if (settings.supportedModelIds?.length && !settings.supportedModelIds.includes(model)) {
		return null;
	}

	const explicitRewrite = settings.modelRewrites?.[model];
	if (explicitRewrite) {
		return {
			cursorFacingModelId: model,
			upstreamModelId: explicitRewrite,
			policyState: model === 'gpt-5.4' && explicitRewrite === 'gpt-5.5'
				? 'workaround_enabled'
				: 'ready'
		};
	}

	if (model === 'gpt-5.4') {
		return {
			cursorFacingModelId: 'gpt-5.4',
			upstreamModelId: settings.gpt54ToGpt55WorkaroundEnabled ? 'gpt-5.5' : 'gpt-5.4',
			policyState: settings.gpt54ToGpt55WorkaroundEnabled
				? 'workaround_enabled'
				: 'workaround_disabled'
		};
	}

	if (model === 'gpt-5.4-mini') {
		return {
			cursorFacingModelId: 'gpt-5.4-mini',
			upstreamModelId: 'gpt-5.4-mini',
			policyState: 'ready'
		};
	}

	if (settings.supportedModelIds?.includes(model)) {
		return {
			cursorFacingModelId: model,
			upstreamModelId: model,
			policyState: 'ready'
		};
	}

	return null;
}

export function readModelRoutingSettingsFromEnv(env: NodeJS.ProcessEnv): ModelRoutingSettings {
	const supportedModelIds = splitCsv(env.CODEX_AUTH_EXT_SUPPORTED_MODELS);
	const modelRewrites = parseModelRewrites(env.CODEX_AUTH_EXT_MODEL_REWRITES);

	return {
		gpt54ToGpt55WorkaroundEnabled: env.CODEX_AUTH_EXT_GPT54_TO_GPT55_WORKAROUND === '1',
		...(supportedModelIds.length ? { supportedModelIds } : {}),
		...(Object.keys(modelRewrites).length ? { modelRewrites } : {})
	};
}

function splitCsv(value: string | undefined): string[] {
	return (value ?? '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseModelRewrites(value: string | undefined): Record<string, string> {
	const rewrites: Record<string, string> = {};

	for (const entry of splitCsv(value)) {
		const [source, target] = entry.split(':').map((item) => item.trim());
		if (source && target) {
			rewrites[source] = target;
		}
	}

	return rewrites;
}
