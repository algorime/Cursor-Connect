# Secret Storage For Codex Tokens

Status: accepted

V1 should store Codex OAuth access and refresh tokens, imported Codex CLI token material, and the generated local API key in VS Code/Cursor `SecretStorage` through the extension host. Normal extension state, dashboard state, or API database files may store only non-secret metadata such as account status, email, account id, token expiry, selected account, and setup progress.

## Consequences

- Access tokens, refresh tokens, ID tokens, imported `~/.codex/auth.json` token material, and generated local API keys should not be stored in a plain SQLite database, JSON state file, logs, recordings, or dashboard-local storage.
- SQLite is acceptable for local non-secret Usage Statistics and metadata, but not for Codex auth secrets or generated local API keys.
- Codex token secrets should be keyed per Codex Account so logout, refresh, switch, and import/export can operate on the correct account.
- Logout/disconnect must delete the Codex Account's secrets from `SecretStorage` and mark the account `auth required`, but should preserve non-secret labels, Usage Statistics, quota history, switch history, and synced metadata references by default.
- Removing non-secret account metadata and per-account Usage Statistics should be a separate confirmed remove-account-data action.
- The local API process should receive tokens through an extension-owned private handoff path, not by independently persisting long-lived token copies.
- Multi-window coordination needs one authority for refresh and token writes so concurrent Cursor windows do not race or overwrite each other.
- The extension host should own token refresh and broker valid access tokens to the local API over a private local control channel or short-lived process state.
- The private control channel should send only request-scoped access tokens and safe account context, never refresh tokens or imported Codex CLI token material.
- The internal control secret used for extension-to-API calls is also secret material and must not be logged, exported, synced, or shown in the dashboard.
- Codex auth secrets should remain separate per extension-host environment by default; any cross-environment sharing/import must be explicit, user-configured, and warning-gated.
- This follows the VS Code Extension API guidance that `context.secrets` is for sensitive data and is encrypted by the platform-specific secret storage implementation.
