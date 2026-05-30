export type PublicUrlVerificationState =
	| 'not_configured'
	| 'invalid'
	| 'unreachable'
	| 'route_health_ok'
	| 'authenticated_ready'
	| 'wrong_key'
	| 'wrong_runtime'
	| 'timeout'
	| 'local_api_down';

export interface PublicUrlState {
	url: string | null;
	state: PublicUrlVerificationState;
	source: 'quick_tunnel' | 'user_provided' | null;
	temporary: boolean;
	runtimeId?: string | null;
	message?: string | null;
}

export function normalizePublicUrl(input: string): string {
	const parsed = new URL(input.trim());
	parsed.hash = '';
	parsed.search = '';
	parsed.pathname = parsed.pathname.replace(/\/+/g, '/').replace(/\/+$/, '');
	return parsed.toString().replace(/\/$/, '');
}

export function buildPublicRouteUrl(input: string, options: { allowHttpForTests?: boolean } = {}): string {
	const normalized = normalizePublicUrl(input);
	const parsed = new URL(normalized);

	if (parsed.protocol !== 'https:' && !(options.allowHttpForTests && parsed.protocol === 'http:')) {
		throw new Error('Public Route URL must use HTTPS');
	}

	const path = parsed.pathname.replace(/\/+$/, '');
	if (path === '/v1') {
		parsed.pathname = '';
	} else if (path.endsWith('/v1')) {
		parsed.pathname = path.slice(0, -3) || '';
	}
	return parsed.toString().replace(/\/$/, '');
}

export function buildVerifiedExtensionBaseUrl(input: string, options: { allowHttpForTests?: boolean } = {}): string {
	const publicRouteUrl = buildPublicRouteUrl(input, options);
	const parsed = new URL(publicRouteUrl);
	const path = parsed.pathname.replace(/\/+$/, '');
	parsed.pathname = `${path}/v1`.replace(/^\/\//, '/');
	return parsed.toString().replace(/\/$/, '');
}
