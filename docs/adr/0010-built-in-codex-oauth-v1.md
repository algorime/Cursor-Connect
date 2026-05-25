# Built-In Codex OAuth In V1

Status: accepted

V1 should include built-in Codex/ChatGPT OAuth instead of relying only on an existing `~/.codex/auth.json` file. The product goal is a fully ready MVP, so authentication should happen inside the extension/dashboard flow rather than requiring users to install or run the Codex CLI first.

## Consequences

- The dashboard needs a first-class Codex sign-in flow with status, connected account identity when available, refresh handling, logout, and adding additional Codex Accounts.
- Existing Codex CLI auth remains useful evidence and should be offered as an explicit import/fallback path, but it is not the primary V1 onboarding path and should not be silently imported.
- Ungate's OpenAI OAuth implementation is a useful UX and protocol reference: PKCE login, local callback server, token exchange, persisted provider settings, refresh, status, and logout.
- The current proxy's Codex auth hardening remains the correctness reference: refresh locking, account-change safety, clear expired/reused/invalidated refresh-token errors, and propagation of ChatGPT account/fedramp claims.
- Stored tokens must be treated as secrets and should live in extension-owned `SecretStorage` with explicit logout deletion.
- Logout/disconnect deletes auth secrets and marks the Codex Account `auth required`, but does not remove local labels, Usage Statistics, quota history, or switch history; removing account data is a separate confirmed action.
- Multiple Codex Accounts are supported in V1; account identity, status, quota, usage, and logout/switch controls should be account-scoped.
- Importing `~/.codex/auth.json` should be a user-initiated recovery or migration action for users who are already authenticated through Codex CLI or whose browser OAuth flow fails.
- If built-in OAuth breaks because the private Codex/ChatGPT OAuth surface changes, the extension should degrade to explicit `~/.codex/auth.json` import fallback rather than pretending setup can complete.
- If neither built-in OAuth nor explicit import is available, setup should show auth unavailable and keep Codex request handling not ready.
- Cross-environment auth sharing/import should be explicit and warning-gated; local, Remote SSH, dev container, and WSL extension hosts should not silently inherit each other's Codex auth.
- Cross-environment import/export should be one-time in V1, with UI explaining source, target, account identity when available, and the target environment's independent refresh lifecycle.
- OAuth should remain in a Codex-specific auth module for V1. Future non-Codex auth should require a separate decision rather than shaping V1 abstractions now.
