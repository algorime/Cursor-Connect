import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { CodexAuthState, RequestScopedAuthContext } from '@codex-auth-ext/shared';

export interface SecretStore {
	get(key: string): Promise<string | undefined>;
	store(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}

export interface CodexTokenSet {
	accessToken: string;
	refreshToken: string;
	idToken?: string;
	expiresAt: number;
	accountId?: string;
	email?: string;
}

export interface CodexAuthMetadata {
	localAccountKey: string;
	accountFingerprint?: string;
	accountLabel?: string;
	expiresAt: number;
	state: CodexAuthState;
}

export interface CodexOAuthClient {
	createAuthorizeUrl(state: string, redirectUri?: string): Promise<{ url: string; codeVerifier: string }>;
	exchangeCode(code: string, codeVerifier: string, redirectUri?: string): Promise<CodexTokenSet>;
	refresh(refreshToken: string): Promise<CodexTokenSet>;
}

export interface CodexOAuthClientOptions {
	clientId?: string;
	authorizeUrl?: string;
	tokenUrl?: string;
	redirectUri?: string;
	fetchImpl?: typeof fetch;
}

const CODEX_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const DEFAULT_AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const DEFAULT_TOKEN_URL = 'https://auth.openai.com/oauth/token';

export class UnavailableCodexOAuthClient implements CodexOAuthClient {
	async createAuthorizeUrl(_state: string, _redirectUri?: string): Promise<{ url: string; codeVerifier: string }> {
		throw new CodexAuthError('oauth_unavailable', 'Built-in Codex OAuth is not available');
	}

	async exchangeCode(_code: string, _codeVerifier: string, _redirectUri?: string): Promise<CodexTokenSet> {
		throw new CodexAuthError('oauth_unavailable', 'Built-in Codex OAuth is not available');
	}

	async refresh(_refreshToken: string): Promise<CodexTokenSet> {
		throw new CodexAuthError('auth_refresh_failed', 'Codex token refresh is not available');
	}
}

export class OpenAICodexOAuthClient implements CodexOAuthClient {
	private readonly clientId: string;
	private readonly authorizeUrl: string;
	private readonly tokenUrl: string;
	private readonly redirectUri?: string;
	private readonly fetchImpl: typeof fetch;

	constructor(options: CodexOAuthClientOptions = {}) {
		this.clientId = options.clientId ?? CODEX_OAUTH_CLIENT_ID;
		this.authorizeUrl = options.authorizeUrl ?? DEFAULT_AUTHORIZE_URL;
		this.tokenUrl = options.tokenUrl ?? DEFAULT_TOKEN_URL;
		this.redirectUri = options.redirectUri;
		this.fetchImpl = options.fetchImpl ?? fetch;
	}

	async createAuthorizeUrl(state: string, redirectUri = this.redirectUri): Promise<{ url: string; codeVerifier: string }> {
		if (!redirectUri) {
			throw new CodexAuthError('oauth_unavailable', 'OAuth redirect URI is required');
		}

		const codeVerifier = base64Url(randomBytes(32));
		const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());
		const url = new URL(this.authorizeUrl);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('client_id', this.clientId);
		url.searchParams.set('redirect_uri', redirectUri);
		url.searchParams.set('scope', 'openid profile email offline_access');
		url.searchParams.set('state', state);
		url.searchParams.set('code_challenge', codeChallenge);
		url.searchParams.set('code_challenge_method', 'S256');
		url.searchParams.set('id_token_add_organizations', 'true');
		url.searchParams.set('codex_cli_simplified_flow', 'true');
		url.searchParams.set('originator', 'codex_cli_rs');

		return {
			url: url.toString(),
			codeVerifier
		};
	}

	async exchangeCode(code: string, codeVerifier: string, redirectUri = this.redirectUri): Promise<CodexTokenSet> {
		return this.exchange({
			grant_type: 'authorization_code',
			code,
			code_verifier: codeVerifier
		}, redirectUri);
	}

	async refresh(refreshToken: string): Promise<CodexTokenSet> {
		return this.exchange({
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		});
	}

	private async exchange(params: Record<string, string>, redirectUri = this.redirectUri): Promise<CodexTokenSet> {
		const body = new URLSearchParams({
			client_id: this.clientId,
			...params
		});
		if (redirectUri && params.grant_type === 'authorization_code') {
			body.set('redirect_uri', redirectUri);
		}

		const response = await this.fetchImpl(this.tokenUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				accept: 'application/json'
			},
			body
		});

		if (!response.ok) {
			throw new CodexAuthError('auth_refresh_failed', 'Codex OAuth token exchange failed');
		}

		const payload = (await response.json()) as unknown;
		if (!isRecord(payload)) {
			throw new CodexAuthError('auth_refresh_failed', 'Codex OAuth token response was invalid');
		}

		const accessToken = stringField(payload.access_token);
		const refreshToken = stringField(payload.refresh_token) ?? stringField(params.refresh_token);
		const idToken = stringField(payload.id_token);
		const expiresIn = numberField(payload.expires_in) ?? 600;

		if (!accessToken || !refreshToken) {
			throw new CodexAuthError('auth_refresh_failed', 'Codex OAuth response was missing tokens');
		}

		const claims = idToken ? decodeJwtClaims(idToken) : {};

		return {
			accessToken,
			refreshToken,
			idToken,
			expiresAt: Date.now() + expiresIn * 1000,
			accountId: readAccountIdClaim(claims),
			email: stringField(claims.email)
		};
	}
}

const TOKEN_SECRET_KEY = 'codexAuthExt.codex.singleAccount.tokens';
const METADATA_SECRET_KEY = 'codexAuthExt.codex.singleAccount.metadata';
const REFRESH_SKEW_MS = 60_000;

export class CodexAuthManager {
	private refreshPromise: Promise<RequestScopedAuthContext> | null = null;

	constructor(
		private readonly secrets: SecretStore,
		private readonly oauthClient: CodexOAuthClient
	) {}

	async startOAuth(redirectUri?: string, requestedState?: string): Promise<{ url: string; state: string; codeVerifier: string }> {
		const state = requestedState ?? randomUUID();
		const session = await this.oauthClient.createAuthorizeUrl(state, redirectUri);

		return {
			state,
			url: session.url,
			codeVerifier: session.codeVerifier
		};
	}

	async completeOAuth(code: string, codeVerifier: string, redirectUri?: string): Promise<CodexAuthMetadata> {
		const tokens = await this.oauthClient.exchangeCode(code, codeVerifier, redirectUri);
		return this.persistTokens(tokens);
	}

	async importAuthJson(filePath = path.join(os.homedir(), '.codex/auth.json')): Promise<CodexAuthMetadata> {
		const raw = await fs.readFile(filePath, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		const tokens = parseCodexAuthJson(parsed);

		return this.persistTokens(tokens);
	}

	async getStatus(): Promise<CodexAuthMetadata | { state: 'not_configured' }> {
		const metadata = await this.readMetadata();
		return metadata ?? { state: 'not_configured' };
	}

	async getRequestScopedAuth(options: { forceRefresh?: boolean } = {}): Promise<RequestScopedAuthContext> {
		if (this.refreshPromise) {
			return this.refreshPromise;
		}

		this.refreshPromise = this.resolveRequestScopedAuth(options).finally(() => {
			this.refreshPromise = null;
		});

		return this.refreshPromise;
	}

	async logout(): Promise<void> {
		await this.secrets.delete(TOKEN_SECRET_KEY);
		const metadata = await this.readMetadata();

		if (metadata) {
			await this.writeMetadata({
				...metadata,
				state: 'auth_required'
			});
		}
	}

	private async resolveRequestScopedAuth(options: { forceRefresh?: boolean }): Promise<RequestScopedAuthContext> {
		const tokens = await this.readTokens();
		const metadata = await this.readMetadata();

		if (!tokens || !metadata) {
			throw new CodexAuthError('auth_required', 'Codex auth is required');
		}

		const shouldRefresh = options.forceRefresh || tokens.expiresAt - Date.now() <= REFRESH_SKEW_MS;
		const freshTokens = shouldRefresh ? await this.refreshTokens(tokens, metadata) : tokens;

		return {
			accessToken: freshTokens.accessToken,
			expiresAt: freshTokens.expiresAt,
			localAccountKey: metadata.localAccountKey,
			accountLabel: metadata.accountLabel,
			accountFingerprint: metadata.accountFingerprint,
			upstreamHeaders: freshTokens.accountId
				? {
						'chatgpt-account-id': freshTokens.accountId,
						originator: 'codex_cli_rs'
					}
				: {
						originator: 'codex_cli_rs'
					}
		};
	}

	private async refreshTokens(
		tokens: CodexTokenSet,
		metadata: CodexAuthMetadata
	): Promise<CodexTokenSet> {
		try {
			const refreshed = await this.oauthClient.refresh(tokens.refreshToken);
			await this.persistTokens({
				...refreshed,
				accountId: refreshed.accountId ?? tokens.accountId,
				email: refreshed.email ?? tokens.email
			});
			return refreshed;
		} catch (error) {
			await this.writeMetadata({
				...metadata,
				state: 'auth_refresh_failed'
			});
			throw new CodexAuthError('auth_refresh_failed', readErrorMessage(error));
		}
	}

	private async persistTokens(tokens: CodexTokenSet): Promise<CodexAuthMetadata> {
		validateTokenSet(tokens);
		await this.secrets.store(TOKEN_SECRET_KEY, JSON.stringify(tokens));

		const existing = await this.readMetadata();
		const metadata: CodexAuthMetadata = {
			localAccountKey: existing?.localAccountKey ?? `codex_${randomUUID()}`,
			accountFingerprint: tokens.accountId ? fingerprint(tokens.accountId) : existing?.accountFingerprint,
			accountLabel: existing?.accountLabel ?? 'Codex Account',
			expiresAt: tokens.expiresAt,
			state: 'authenticated'
		};

		await this.writeMetadata(metadata);

		return metadata;
	}

	private async readTokens(): Promise<CodexTokenSet | null> {
		const raw = await this.secrets.get(TOKEN_SECRET_KEY);
		return raw ? (JSON.parse(raw) as CodexTokenSet) : null;
	}

	private async readMetadata(): Promise<CodexAuthMetadata | null> {
		const raw = await this.secrets.get(METADATA_SECRET_KEY);
		return raw ? (JSON.parse(raw) as CodexAuthMetadata) : null;
	}

	private async writeMetadata(metadata: CodexAuthMetadata): Promise<void> {
		await this.secrets.store(METADATA_SECRET_KEY, JSON.stringify(metadata));
	}
}

export class CodexAuthError extends Error {
	constructor(
		readonly code: 'auth_required' | 'auth_refresh_failed' | 'invalid_import' | 'oauth_unavailable',
		message: string
	) {
		super(message);
	}
}

export function parseCodexAuthJson(value: unknown): CodexTokenSet {
	if (!isRecord(value)) {
		throw new CodexAuthError('invalid_import', 'auth file must contain a JSON object');
	}

	if (
		typeof value.OPENAI_API_KEY === 'string' ||
		typeof value.openai_api_key === 'string' ||
		value.auth_mode === 'api_key'
	) {
		throw new CodexAuthError('invalid_import', 'API-key auth cannot be imported as Codex OAuth');
	}

	const tokenContainer = isRecord(value.tokens) ? value.tokens : value;
	const accessToken = stringField(tokenContainer.access_token) ?? stringField(tokenContainer.accessToken);
	const refreshToken =
		stringField(tokenContainer.refresh_token) ?? stringField(tokenContainer.refreshToken);
	const idToken = stringField(tokenContainer.id_token) ?? stringField(tokenContainer.idToken);
	const expiresAt =
		numberField(tokenContainer.expires_at) ??
		numberField(tokenContainer.expiresAt) ??
		numberField(value.expires_at) ??
		numberField(value.expiresAt) ??
		(Date.now() + 10 * 60 * 1000);

	if (!accessToken || !refreshToken) {
		throw new CodexAuthError('invalid_import', 'auth file is missing OAuth token material');
	}

	return {
		accessToken,
		refreshToken,
		idToken,
		expiresAt,
		accountId:
			stringField(tokenContainer.account_id) ??
			stringField(tokenContainer.accountId) ??
			stringField(value.account_id) ??
			stringField(value.accountId),
		email: stringField(tokenContainer.email) ?? stringField(value.email)
	};
}

function validateTokenSet(tokens: CodexTokenSet): void {
	if (!tokens.accessToken || !tokens.refreshToken || !Number.isFinite(tokens.expiresAt)) {
		throw new CodexAuthError('invalid_import', 'invalid Codex token material');
	}
}

function fingerprint(value: string): string {
	return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function base64Url(value: Buffer): string {
	return value.toString('base64url');
}

function decodeJwtClaims(token: string): Record<string, unknown> {
	const [, payload] = token.split('.');
	if (!payload) {
		return {};
	}

	try {
		const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
		return isRecord(decoded) ? decoded : {};
	} catch {
		return {};
	}
}

function readAccountIdClaim(claims: Record<string, unknown>): string | undefined {
	const authClaims = claims['https://api.openai.com/auth'];
	if (isRecord(authClaims)) {
		const accountId = stringField(authClaims.chatgpt_account_id);
		if (accountId) {
			return accountId;
		}
	}

	return stringField(claims.chatgpt_account_id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberField(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Codex refresh failed';
}
