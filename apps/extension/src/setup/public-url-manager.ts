import {
	buildPublicRouteUrl,
	buildVerifiedExtensionBaseUrl,
	type PublicUrlState
} from '@codex-auth-ext/shared';

import type { ExtensionStateStore } from '../settings/model-routing.js';

const PUBLIC_URL_KEY = 'codexAuthExt.setup.publicUrl';

export interface PublicUrlVerificationOptions {
	source?: PublicUrlState['source'];
}

export interface PublicUrlManagerOptions {
	state: ExtensionStateStore;
	fetchImpl?: typeof fetch;
	getLocalApiKey: () => Promise<string>;
	getExpectedRuntimeId: () => string | null | undefined;
	allowHttpForTests?: boolean;
	timeoutMs?: number;
}

export class PublicUrlManager {
	private readonly state: ExtensionStateStore;
	private readonly fetchImpl: typeof fetch;
	private readonly getLocalApiKey: () => Promise<string>;
	private readonly getExpectedRuntimeId: () => string | null | undefined;
	private readonly allowHttpForTests: boolean;
	private readonly timeoutMs: number;
	private lastState: PublicUrlState;

	constructor(options: PublicUrlManagerOptions) {
		this.state = options.state;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.getLocalApiKey = options.getLocalApiKey;
		this.getExpectedRuntimeId = options.getExpectedRuntimeId;
		this.allowHttpForTests = options.allowHttpForTests ?? false;
		this.timeoutMs = options.timeoutMs ?? 5_000;
		this.lastState = withPublicUrlDefaults(this.state.get<PublicUrlState>(PUBLIC_URL_KEY) ?? { url: null, state: 'not_configured' } as PublicUrlState);
	}

	getState(): PublicUrlState {
		return structuredClone(this.getEffectiveState());
	}

	getCursorBaseUrl(): string | null {
		const state = this.getEffectiveState();
		if (state.state !== 'authenticated_ready' || !state.url) {
			return null;
		}

		return buildVerifiedExtensionBaseUrl(state.url, { allowHttpForTests: this.allowHttpForTests });
	}

	async verify(input: string, options: PublicUrlVerificationOptions = {}): Promise<PublicUrlState> {
		const source = options.source ?? 'user_provided';
		const temporary = source === 'quick_tunnel';
		const normalized = this.normalize(input);
		if (normalized === 'invalid') {
			return this.persist({ url: input.trim(), state: 'invalid', source, temporary, message: 'Public Route URL must be a valid HTTPS URL' });
		}

		const health = await this.fetchJson(`${normalized}/health`);
		if (health.error === 'timeout') {
			return this.persist({ url: normalized, state: 'timeout', source, temporary, message: 'Public URL /health timed out' });
		}
		if (!health.ok || health.status !== 200 || health.body?.status !== 'ok') {
			const suffix = health.status > 0 ? ` (HTTP ${health.status})` : '';
			return this.persist({ url: normalized, state: 'unreachable', source, temporary, message: `Public URL did not return minimal /health${suffix}` });
		}

		const ready = await this.fetchJson(`${normalized}/ready`, {
			headers: {
				authorization: `Bearer ${await this.getLocalApiKey()}`
			}
		});
		if (ready.error === 'timeout') {
			return this.persist({ url: normalized, state: 'timeout', source, temporary, message: 'Public URL /ready timed out' });
		}
		if (ready.status === 401 || ready.status === 403) {
			return this.persist({ url: normalized, state: 'wrong_key', source, temporary, message: 'Public URL rejected the generated local API key' });
		}
		if (!ready.ok) {
			return this.persist({ url: normalized, state: 'route_health_ok', source, temporary, message: 'Public URL is live but /ready is not authenticated-ready' });
		}

		const runtimeId = typeof ready.body?.runtimeId === 'string' ? ready.body.runtimeId : null;
		const expected = this.getExpectedRuntimeId();
		if (expected && !runtimeId) {
			return this.persist({ url: normalized, state: 'wrong_runtime', source, temporary, runtimeId, message: 'Public URL did not return current runtime proof' });
		}
		if (expected && runtimeId && runtimeId !== expected) {
			return this.persist({ url: normalized, state: 'wrong_runtime', source, temporary, runtimeId, message: 'Public URL points at a different extension runtime' });
		}
		if (!ready.body?.ready) {
			return this.persist({ url: normalized, state: 'route_health_ok', source, temporary, runtimeId, message: 'Public URL reached this runtime but Codex proxy is not ready' });
		}

		return this.persist({ url: normalized, state: 'authenticated_ready', source, temporary, runtimeId });
	}

	async markStale(message: string): Promise<PublicUrlState> {
		return this.persist({ ...this.lastState, state: this.lastState.url ? 'route_health_ok' : 'not_configured', message });
	}

	private normalize(input: string): string | 'invalid' {
		try {
			return buildPublicRouteUrl(input, { allowHttpForTests: this.allowHttpForTests });
		} catch {
			return 'invalid';
		}
	}

	private getEffectiveState(): PublicUrlState {
		const state = withPublicUrlDefaults(this.lastState);
		const expected = this.getExpectedRuntimeId();
		if (state.state !== 'authenticated_ready' || !state.url || !expected) {
			return state;
		}
		if (!state.runtimeId) {
			return {
				...state,
				state: 'wrong_runtime',
				message: 'Public URL did not return current runtime proof; reverify this route.'
			};
		}
		if (state.runtimeId !== expected) {
			return {
				...state,
				state: 'wrong_runtime',
				message: 'Public URL was verified for a different extension runtime; reverify this route.'
			};
		}
		return state;
	}

	private async fetchJson(input: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: Record<string, unknown> | null; error?: 'timeout' | 'network' }> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await this.fetchImpl(input, { ...init, signal: init?.signal ?? controller.signal });
			const body = await response.json().catch(() => null) as Record<string, unknown> | null;
			return { ok: response.ok, status: response.status, body };
		} catch (error) {
			return { ok: false, status: 0, body: null, error: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network' };
		} finally {
			clearTimeout(timeout);
		}
	}

	private async persist(state: PublicUrlState): Promise<PublicUrlState> {
		this.lastState = withPublicUrlDefaults(state);
		await this.state.update(PUBLIC_URL_KEY, this.lastState);
		return this.getState();
	}
}

function withPublicUrlDefaults(state: PublicUrlState): PublicUrlState {
	const source = state.source ?? (state.url ? 'user_provided' : null);
	return {
		...state,
		source,
		temporary: state.temporary ?? source === 'quick_tunnel'
	};
}
