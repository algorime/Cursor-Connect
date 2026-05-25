export interface CursorSetupDetails {
	baseUrl: string | null;
	apiKey: string;
	localTargetUrl: string;
	models: string[];
	publicUrlRequired: boolean;
}

export function buildCursorSetupDetails(options: {
	localTargetUrl: string;
	extensionBaseUrl?: string;
	apiKey: string;
}): CursorSetupDetails {
	const extensionBaseUrl = options.extensionBaseUrl?.replace(/\/+$/, '');

	return {
		baseUrl: extensionBaseUrl ? `${extensionBaseUrl}/v1` : null,
		apiKey: options.apiKey,
		localTargetUrl: options.localTargetUrl,
		models: ['gpt-5.4', 'gpt-5.4-mini'],
		publicUrlRequired: !extensionBaseUrl
	};
}

export function serializeCursorSetup(details: CursorSetupDetails): string {
	return JSON.stringify(
			{
				baseUrl: details.baseUrl,
				apiKey: details.apiKey,
				localTargetUrl: details.localTargetUrl,
				publicUrlRequired: details.publicUrlRequired,
				models: details.models,
				recommendedModel: details.models[0]
			},
		null,
		2
	);
}
