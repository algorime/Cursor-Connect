export interface OAuthUriLike {
	toString(): string;
}

export interface OAuthBrowserCallbackEnvironment {
	parseUri(value: string): OAuthUriLike;
	asExternalUri(uri: OAuthUriLike): PromiseLike<OAuthUriLike>;
}

export interface OAuthBrowserCallbackPreparation {
	prepared: boolean;
	compatibleWithFixedRedirect: boolean;
	externalUri?: string;
	errorMessage?: string;
}

export async function prepareOAuthCallbackForBrowser(
	callbackUri: string,
	environment: OAuthBrowserCallbackEnvironment
): Promise<OAuthBrowserCallbackPreparation> {
	try {
		const externalUri = await environment.asExternalUri(environment.parseUri(callbackUri));
		const externalUriString = externalUri.toString();

		return {
			prepared: true,
			compatibleWithFixedRedirect: isCompatibleWithFixedRedirect(callbackUri, externalUriString),
			externalUri: externalUriString
		};
	} catch (error) {
		return {
			prepared: false,
			compatibleWithFixedRedirect: false,
			errorMessage: error instanceof Error ? error.message : 'callback forwarding failed'
		};
	}
}

function isCompatibleWithFixedRedirect(callbackUri: string, externalUri: string): boolean {
	try {
		const callback = new URL(callbackUri);
		const external = new URL(externalUri);
		const callbackPort = callback.port || defaultPort(callback.protocol);
		const externalPort = external.port || defaultPort(external.protocol);

		return isLocalhost(external.hostname) && externalPort === callbackPort && external.pathname === callback.pathname;
	} catch {
		return false;
	}
}

function isLocalhost(hostname: string): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function defaultPort(protocol: string): string {
	if (protocol === 'http:') {
		return '80';
	}
	if (protocol === 'https:') {
		return '443';
	}

	return '';
}
