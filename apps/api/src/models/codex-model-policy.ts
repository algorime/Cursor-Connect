import type {
	CodexModelEntry,
	CursorFacingModelId,
	ModelPolicyState,
	UpstreamModelId
} from '@codex-auth-ext/shared';

export interface ModelRoutingSettings {
	gpt54ToGpt55WorkaroundEnabled: boolean;
}

export interface ResolvedModelRoute {
	cursorFacingModelId: CursorFacingModelId;
	upstreamModelId: UpstreamModelId;
	policyState: ModelPolicyState;
}

export function listSupportedModels(settings: ModelRoutingSettings): CodexModelEntry[] {
	const gpt54Route = resolveModelRoute('gpt-5.4', settings);
	const miniRoute = resolveModelRoute('gpt-5.4-mini', settings);

	if (!gpt54Route || !miniRoute) {
		throw new Error('built-in Codex model policy is misconfigured');
	}

	return [
		{
			id: 'gpt-5.4',
			object: 'model',
			owned_by: 'codex-auth-first',
			upstreamModelId: gpt54Route.upstreamModelId,
			supported: true,
			recommended: true,
			workaroundRequired: true,
			policyState: gpt54Route.policyState
		},
		{
			id: 'gpt-5.4-mini',
			object: 'model',
			owned_by: 'codex-auth-first',
			upstreamModelId: miniRoute.upstreamModelId,
			supported: true,
			recommended: false,
			workaroundRequired: false,
			policyState: miniRoute.policyState
		}
	];
}

export function resolveModelRoute(
	model: string,
	settings: ModelRoutingSettings
): ResolvedModelRoute | null {
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

	return null;
}
