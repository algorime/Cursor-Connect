export interface CursorSetupDetails {
	baseUrl: string | null;
	apiKey: string;
	localTargetUrl: string;
	routeKind: 'quick_tunnel' | 'user_provided' | 'none';
	temporaryRoute: boolean;
	routeWarning: string | null;
	models: string[];
	publicUrlRequired: boolean;
	instructions: string;
	manualConfirmationRequired: boolean;
	rotationWarning: string | null;
}

export const CURSOR_SETUP_MODELS = ['gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4'] as const;

export function buildCursorSetupDetails(options: {
	localTargetUrl: string;
	extensionBaseUrl?: string;
	apiKey: string;
	routeKind?: CursorSetupDetails['routeKind'];
	temporaryRoute?: boolean;
	manualConfirmationRequired?: boolean;
	apiKeyRotated?: boolean;
}): CursorSetupDetails {
	const extensionBaseUrl = options.extensionBaseUrl?.replace(/\/+$/, '');
	const cursorBaseUrl = extensionBaseUrl
		? extensionBaseUrl.endsWith('/v1') ? extensionBaseUrl : `${extensionBaseUrl}/v1`
		: null;
	const routeKind = options.routeKind ?? (cursorBaseUrl ? 'user_provided' : 'none');
	const temporaryRoute = options.temporaryRoute ?? routeKind === 'quick_tunnel';

	return {
		baseUrl: cursorBaseUrl,
		apiKey: options.apiKey,
		localTargetUrl: options.localTargetUrl,
		routeKind,
		temporaryRoute,
		routeWarning: temporaryRoute
			? 'Temporary Quick Tunnel route: this URL can change or stop. If it changes, restart Quick Tunnel and update Cursor settings.'
			: routeKind === 'user_provided'
				? 'Durable route: keep your public HTTPS forwarding target pointed at the local target.'
				: 'No verified public Extension Base URL yet. Do not paste the local target as Cursor Base URL.',
		models: [...CURSOR_SETUP_MODELS],
		publicUrlRequired: !extensionBaseUrl,
		instructions: 'Recommended setup: select direct Cursor-facing gpt-5.5. Use gpt-5.4-mini as a secondary model and avoid arbitrary custom model IDs unless a Harness Capture verifies them.',
		manualConfirmationRequired: options.manualConfirmationRequired ?? false,
		rotationWarning: options.apiKeyRotated ? 'Local API key was rotated; old keys stop working after the API restart and Cursor settings must be updated.' : null
	};
}

export function serializeCursorSetup(details: CursorSetupDetails): string {
	return JSON.stringify(
			{
				baseUrl: details.baseUrl,
				apiKey: details.apiKey,
				localTargetUrl: details.localTargetUrl,
				routeKind: details.routeKind,
				temporaryRoute: details.temporaryRoute,
				routeWarning: details.routeWarning,
				publicUrlRequired: details.publicUrlRequired,
				models: details.models,
				recommendedModel: details.models[0],
				instructions: details.instructions
			},
		null,
		2
	);
}
