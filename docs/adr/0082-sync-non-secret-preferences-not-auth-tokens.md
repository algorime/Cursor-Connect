# Sync Non-Secret Preferences, Not Auth Tokens

Status: accepted

V1 should provide the best cross-environment UX possible by syncing non-secret metadata and preferences where the Cursor/VS Code platform supports it, while keeping OAuth tokens, generated local API keys, runtime state, tunnel state, and Usage Statistics per extension-host environment. Full continuous token sync is out of V1; cross-environment auth sharing remains explicit one-time transfer/import.

When platform Settings Sync is enabled and available, syncable non-secret metadata should sync automatically rather than requiring a second extension-level opt-in.

## Consequences

- Syncable non-secret state may include Codex Account Labels, notification preferences, status bar preferences, model/workaround preferences, account priority order, manual-only flags, and preferred Codex Account Switch Policy.
- Sync should use platform-supported extension state sync when available, such as VS Code `globalState.setKeysForSync`, rather than an extension-owned cloud service in V1.
- The extension should respect the user's platform Settings Sync state and degrade gracefully when sync is unavailable or disabled.
- UI should clearly distinguish synced metadata from non-synced auth/runtime state.
- Secrets must not be placed in synced global state: OAuth access tokens, refresh tokens, ID tokens, imported Codex CLI auth material, generated local API keys, tunnel credentials, and transfer payloads remain outside sync.
- Runtime-specific state must not sync: active local API process, Cloudflare Quick Tunnel URL, local port, health/readiness state, Usage Statistics SQLite database, raw diagnostics, and quota cache remain per extension-host environment.
- When the same Codex Account exists in another environment, synced metadata should be matched using a privacy-safe stable account fingerprint derived from a stable opaque account ID, never from email.
- Raw account identity should remain local to authenticated hosts; the fingerprint is only for matching Syncable Account Metadata.
- If synced metadata arrives before the matching Codex Account exists locally, it may remain pending and apply after the user signs in or imports that account.
- Synced Codex Account Switch Policy preferences should remain pending or incomplete until the referenced Codex Accounts exist and are authenticated in the current extension-host environment.
- If matching is ambiguous, the UI should ask the user rather than guessing.
- Sync conflicts should use the mixed policy from `0085-syncable-metadata-conflict-resolution.md`: last-writer-wins for low-risk scalar preferences, explicit review for account-affecting changes, and local override available.
- Sync improves setup continuity but does not mean an account is authenticated in the target environment.
- Logout/disconnect does not automatically remove synced non-secret metadata; removing account data should explicitly remove or retire synced account metadata references for that Codex Account.
- Remove-account-data may sync a non-secret account-metadata tombstone, but it must not delete auth secrets, Usage Statistics, quota cache, or runtime state in other environments.
- If a removed account signs in again and matches a previous fingerprint, restoring synced metadata should require user review rather than happening silently.
- Future full encrypted auth sync would require a separate decision because it needs a real sync authority, token-rotation coordination, device approval, revoke/delete semantics, and recovery UX.
