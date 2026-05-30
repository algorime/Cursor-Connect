import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	CodexAuthError,
	CodexAuthManager,
	OpenAICodexOAuthClient,
	parseCodexAuthJson,
	type CodexOAuthClient,
	type CodexTokenSet,
	type SecretStore
} from '../src/codex-auth/codex-auth-manager.js';
import { waitForOAuthCallback } from '../src/codex-auth/oauth-callback-server.js';
import {
	InMemoryExtensionStateStore,
	ModelRoutingSettingsStore
} from '../src/settings/model-routing.js';

class MemorySecretStore implements SecretStore {
	readonly values = new Map<string, string>();

	async get(key: string): Promise<string | undefined> {
		return this.values.get(key);
	}

	async store(key: string, value: string): Promise<void> {
		this.values.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.values.delete(key);
	}
}

class FakeOAuthClient implements CodexOAuthClient {
	refreshCalls = 0;
	failRefresh = false;
	omitAccountId = false;

	async createAuthorizeUrl(state: string): Promise<{ url: string; codeVerifier: string }> {
		return {
			url: `https://auth.openai.com/oauth/authorize?state=${state}`,
			codeVerifier: 'fixture-code-verifier'
		};
	}

	async exchangeCode(_code: string, _codeVerifier: string): Promise<CodexTokenSet> {
		return tokenSet('access-from-code', 'refresh-from-code', this.omitAccountId);
	}

	async refresh(_refreshToken: string): Promise<CodexTokenSet> {
		this.refreshCalls += 1;
		if (this.failRefresh) {
			throw new Error('refresh_token_invalidated');
		}
		return tokenSet(`access-refreshed-${this.refreshCalls}`, 'refresh-rotated', this.omitAccountId);
	}
}

describe('CodexAuthManager', () => {
	it('builds built-in OAuth URLs and exchanges tokens through the OpenAI Codex OAuth client', async () => {
		const tokenPayloads: unknown[] = [
			{
				access_token: 'oauth-access',
				refresh_token: 'oauth-refresh',
				id_token: fixtureIdToken(),
				expires_in: 600
			},
			{
				access_token: 'oauth-refreshed',
				refresh_token: 'oauth-refresh-rotated',
				expires_in: 600
			}
		];
		const client = new OpenAICodexOAuthClient({
			redirectUri: 'http://127.0.0.1:12345/callback',
			fetchImpl: async (_input, init) => {
				expect(init?.method).toBe('POST');
				const body = init?.body as URLSearchParams;
				expect(body.get('client_id')).toBe('app_EMoamEEZ73f0CkXaXp7hrann');
				return new Response(JSON.stringify(tokenPayloads.shift()), { status: 200 });
			}
		});
		const started = await client.createAuthorizeUrl('state-fixture');
		const authorizeUrl = new URL(started.url);

		expect(authorizeUrl.hostname).toBe('auth.openai.com');
		expect(authorizeUrl.searchParams.get('codex_cli_simplified_flow')).toBe('true');
		expect(authorizeUrl.searchParams.get('originator')).toBe('codex_cli_rs');
		expect(authorizeUrl.searchParams.get('scope')).toBe(
			'openid profile email offline_access api.connectors.read api.connectors.invoke'
		);

		const exchanged = await client.exchangeCode('code-fixture', started.codeVerifier);
		expect(exchanged).toMatchObject({
			accessToken: 'oauth-access',
			refreshToken: 'oauth-refresh',
			accountId: 'acct_oauth',
			email: 'fixture@example.invalid'
		});

		await expect(client.refresh('oauth-refresh')).resolves.toMatchObject({
			accessToken: 'oauth-refreshed',
			refreshToken: 'oauth-refresh-rotated'
		});
	});

	it('carries dynamic OAuth redirect URI from authorize URL into token exchange', async () => {
		const dynamicRedirectUri = 'http://127.0.0.1:54321/callback';
		const seenRedirectUris: Array<string | null> = [];
		const client = new OpenAICodexOAuthClient({
			fetchImpl: async (_input, init) => {
				const body = init?.body as URLSearchParams;
				seenRedirectUris.push(body.get('redirect_uri'));
				return new Response(
					JSON.stringify({
						access_token: 'dynamic-access',
						refresh_token: 'dynamic-refresh',
						id_token: fixtureIdToken(),
						expires_in: 600
					}),
					{ status: 200 }
				);
			}
		});
		const manager = new CodexAuthManager(new MemorySecretStore(), client);
		const started = await manager.startOAuth(dynamicRedirectUri, 'dynamic-state');

		expect(new URL(started.url).searchParams.get('redirect_uri')).toBe(dynamicRedirectUri);
		await manager.completeOAuth('dynamic-code', started.codeVerifier, dynamicRedirectUri);

		expect(seenRedirectUris).toEqual([dynamicRedirectUri]);
	});

	it('uses the Codex CLI registered loopback callback path for browser OAuth', async () => {
		const callbackServer = await waitForOAuthCallback({ state: 'callback-state' });
		try {
			const redirectUri = new URL(callbackServer.redirectUri);

			expect(redirectUri.hostname).toBe('localhost');
			expect(redirectUri.port).toBe('1455');
			expect(redirectUri.pathname).toBe('/auth/callback');
		} finally {
			await callbackServer.dispose();
		}
	});

	it('starts and completes built-in OAuth into SecretStorage-backed metadata', async () => {
		const secrets = new MemorySecretStore();
		const manager = new CodexAuthManager(secrets, new FakeOAuthClient());
		const start = await manager.startOAuth();

		expect(start.url).toContain('auth.openai.com');

		const metadata = await manager.completeOAuth('code', start.codeVerifier);

		expect(metadata.state).toBe('authenticated');
		expect(metadata.accountFingerprint).toBeDefined();
		expect(JSON.stringify([...secrets.values.values()])).toContain('access-from-code');
	});

	it('does not mark OAuth complete when the account id claim is missing', async () => {
		const secrets = new MemorySecretStore();
		const oauth = new FakeOAuthClient();
		oauth.omitAccountId = true;
		const manager = new CodexAuthManager(secrets, oauth);

		await expect(manager.completeOAuth('code', 'verifier')).rejects.toMatchObject({
			code: 'account_id_missing'
		});
		await expect(manager.getStatus()).resolves.toMatchObject({ state: 'account_id_missing' });
		expect(JSON.stringify([...secrets.values.values()])).not.toContain('access-from-code');
	});

	it('imports explicit auth.json token material and rejects API-key auth', async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-auth-import-'));
		const importPath = path.join(dir, 'auth.json');
		const manager = new CodexAuthManager(new MemorySecretStore(), new FakeOAuthClient());

		await fs.writeFile(
			importPath,
			JSON.stringify({
				access_token: 'import-access',
				refresh_token: 'import-refresh',
				expires_at: Date.now() + 60_000,
				account_id: 'acct_import'
			})
		);

		await expect(manager.importAuthJson(importPath)).resolves.toMatchObject({
			state: 'authenticated'
		});

		expect(() => parseCodexAuthJson({ OPENAI_API_KEY: 'sk-test' })).toThrow(CodexAuthError);
	});

	it('imports the nested Codex CLI auth.json token shape', () => {
		const parsed = parseCodexAuthJson({
			auth_mode: 'chatgpt',
			tokens: {
				access_token: 'nested-access',
				refresh_token: 'nested-refresh',
				id_token: 'nested-id',
				expires_at: 1779729999999,
				account_id: 'acct_nested'
			}
		});

		expect(parsed).toMatchObject({
			accessToken: 'nested-access',
			refreshToken: 'nested-refresh',
			idToken: 'nested-id',
			accountId: 'acct_nested'
		});
	});

	it('rejects imported OAuth token material without an account id', async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-auth-import-missing-account-'));
		const importPath = path.join(dir, 'auth.json');
		const manager = new CodexAuthManager(new MemorySecretStore(), new FakeOAuthClient());

		await fs.writeFile(
			importPath,
			JSON.stringify({
				access_token: 'import-access',
				refresh_token: 'import-refresh',
				expires_at: Date.now() + 60_000
			})
		);

		await expect(manager.importAuthJson(importPath)).rejects.toMatchObject({
			code: 'account_id_missing'
		});
		await expect(manager.getStatus()).resolves.toMatchObject({ state: 'account_id_missing' });
	});

	it('serializes refresh and marks only the account auth-refresh-failed on refresh errors', async () => {
		const secrets = new MemorySecretStore();
		const oauth = new FakeOAuthClient();
		const manager = new CodexAuthManager(secrets, oauth);

		await manager.completeOAuth('code', 'verifier');
		const [first, second] = await Promise.all([
			manager.getRequestScopedAuth({ forceRefresh: true }),
			manager.getRequestScopedAuth({ forceRefresh: true })
		]);

		expect(first.accessToken).toBe(second.accessToken);
		expect(oauth.refreshCalls).toBe(1);

		oauth.failRefresh = true;
		await expect(manager.getRequestScopedAuth({ forceRefresh: true })).rejects.toMatchObject({
			code: 'auth_refresh_failed'
		});
		await expect(manager.getStatus()).resolves.toMatchObject({ state: 'auth_refresh_failed' });
	});

	it('logout deletes token secrets but preserves non-secret auth-required metadata', async () => {
		const secrets = new MemorySecretStore();
		const manager = new CodexAuthManager(secrets, new FakeOAuthClient());

		await manager.completeOAuth('code', 'verifier');
		await manager.logout();

		expect([...secrets.values.values()].join('\n')).not.toContain('access-from-code');
		await expect(manager.getStatus()).resolves.toMatchObject({ state: 'auth_required' });
	});

	it('hands off Cursor-Azure-compatible upstream account headers without refresh material', async () => {
		const manager = new CodexAuthManager(new MemorySecretStore(), new FakeOAuthClient());

		await manager.completeOAuth('code', 'verifier');
		const context = await manager.getRequestScopedAuth();

		expect(context.upstreamHeaders).toMatchObject({
			'ChatGPT-Account-Id': 'acct_fixture',
			'X-OpenAI-Fedramp': 'true',
			originator: 'codex_cli_rs'
		});
		expect(JSON.stringify(context)).not.toMatch(/refresh-from-code|refresh-rotated|id-token-fixture/i);
	});
});

describe('ModelRoutingSettingsStore', () => {
	it('keeps the dormant model workaround disabled even if legacy state opts in', async () => {
		const store = new ModelRoutingSettingsStore(new InMemoryExtensionStateStore());

		expect(store.getGpt54ToGpt55WorkaroundEnabled()).toBe(false);
		expect(store.getGpt54ToGpt55WorkaroundDecision()).toBe('skipped');
		await store.setGpt54ToGpt55WorkaroundDecision('enabled');
		expect(store.getGpt54ToGpt55WorkaroundEnabled()).toBe(false);
		expect(store.getGpt54ToGpt55WorkaroundDecision()).toBe('skipped');
		await store.setGpt54ToGpt55WorkaroundDecision('skipped');
		expect(store.getGpt54ToGpt55WorkaroundEnabled()).toBe(false);
		expect(store.getGpt54ToGpt55WorkaroundDecision()).toBe('skipped');
	});
});

function tokenSet(accessToken: string, refreshToken: string, omitAccountId = false): CodexTokenSet {
	return {
		accessToken,
		refreshToken,
		idToken: 'id-token-fixture',
		expiresAt: Date.now() + 60_000,
		accountId: omitAccountId ? undefined : 'acct_fixture',
		fedramp: true,
		email: 'fixture@example.invalid'
	};
}

function fixtureIdToken(): string {
	const claims = Buffer.from(
		JSON.stringify({
			email: 'fixture@example.invalid',
			'https://api.openai.com/auth': {
				chatgpt_account_id: 'acct_oauth'
			}
		})
	).toString('base64url');

	return `header.${claims}.signature`;
}
