# Codex OAuth Research

## Decision Context

V1 should include built-in Codex/ChatGPT OAuth. The user explicitly rejected relying on external Codex CLI setup as the primary path: V1 should be "already MVP fully ready".

## Ungate Reference

Ungate implements OpenAI/ChatGPT OAuth in `.sources/ungate/apps/api/src/auth/openai/`.

Relevant files:

- `openai-oauth-service.ts`
- `oauth-client.ts`
- `openai-oauth-utils.ts`
- `callback-server.ts`
- `pkce-session-store.ts`
- `routes/auth.ts`
- `database/provider-settings.ts`
- `tests/integration/auth/auth-openai-oauth-lifecycle.test.ts`

Observed flow:

- `GET /auth/openai/start` creates a PKCE verifier/challenge and session id.
- It starts a local callback server on `127.0.0.1` using the configured redirect URI.
- It builds an authorize URL for `https://auth.openai.com/oauth/authorize`.
- It uses client id `app_EMoamEEZ73f0CkXaXp7hrann`.
- It requests scope `openid profile email offline_access`.
- It sends extra params `id_token_add_organizations=true`, `codex_cli_simplified_flow=true`, and `originator=codex_cli_rs`.
- Callback completion exchanges the code at `https://auth.openai.com/oauth/token` using `authorization_code` plus the PKCE verifier.
- ID token parsing extracts email and `https://api.openai.com/auth` claims.
- Workspace/account selection uses `chatgpt_account_id`, plan type, and organization metadata.
- Tokens are persisted through `ProviderSettings.upsertOAuth('openai', credentials)`.
- `getValidToken()` returns existing credentials until near expiry, then refreshes with `grant_type=refresh_token`.
- `POST /auth/openai/logout` removes the stored provider credentials.

Useful pieces to carry forward:

- Dashboard-owned sign-in status and logout UX.
- PKCE session creation and expiry cleanup.
- Local callback server that stops after success/error/timeout.
- ID-token parsing for email and account id.
- Refresh-token flow using the same OpenAI/Codex OAuth client id and originator semantics as Codex CLI.

Gaps to harden for V1:

- Ungate stores provider credentials in its provider settings database; V1 should explicitly classify this as secret storage and prefer extension-owned secure/private storage where practical.
- Ungate's refresh path returns `null` on most token failures; V1 should preserve clear user-facing errors for expired, reused, invalidated, or rejected refresh tokens.
- Ungate does not implement the current proxy's file/refresh lock behavior; V1 should avoid concurrent refresh races across windows/processes.
- Ungate does not guard against overwriting a freshly refreshed token or a changed account the way the current proxy's `CodexAuthStore.save_tokens()` does.
- V1 should preserve ChatGPT account id and fedramp claim propagation because the current proxy already relies on those upstream headers.

## Existing Proxy Reference

The active proxy currently relies on `~/.codex/auth.json` rather than built-in OAuth, but its hardening should be retained conceptually:

- Decode access-token claims without verifying signatures to discover expiry, account id, and fedramp state.
- Refresh before expiry using a skew window.
- Serialize refresh with a lock.
- Avoid overwriting tokens when another process has already refreshed or the account changed.
- Emit specific messages for refresh-token expiration, reuse, or invalidation.
- Include account/fedramp/session headers when forwarding Codex requests upstream.

## V1 Recommendation

Use Ungate's built-in OAuth flow as the onboarding UX baseline and the current proxy's auth-store behavior as the reliability baseline. Do not require Codex CLI login for the happy path.

V1 should also support explicit import from `~/.codex/auth.json` as a secondary fallback for users who are already authenticated through Codex CLI or whose browser OAuth flow fails. This import should be user-initiated rather than silent, because it copies sensitive auth material into extension-owned storage and changes which account the extension will use.

If the built-in OAuth surface changes or becomes unavailable, the product should degrade to this explicit import path. If neither OAuth nor import can provide usable token/account material, the setup should remain auth-unavailable rather than guessing identity or claiming readiness.

OAuth access tokens, refresh tokens, ID tokens, and imported Codex CLI token material should be stored in VS Code/Cursor `SecretStorage`. Normal state or database files should store only non-secret metadata such as auth status, email, account id, expiry, and provider setup progress. The extension host should own refresh and broker valid access tokens to the local API over a private control channel or short-lived process state instead of duplicating long-lived secrets in plaintext storage.
