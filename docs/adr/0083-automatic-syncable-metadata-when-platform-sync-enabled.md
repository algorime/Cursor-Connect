# Automatic Syncable Metadata When Platform Sync Enabled

Status: accepted

Syncable Account Metadata and other non-secret preferences should sync automatically when the user's Cursor/VS Code platform Settings Sync is enabled and available. V1 should not add a separate extension-specific opt-in for this safe metadata sync, but the UI must clearly explain that auth tokens and runtime state are not synced.

## Consequences

- Use platform-supported sync mechanisms for selected non-secret keys, such as VS Code `globalState.setKeysForSync`.
- Respect the user's global Cursor/VS Code Settings Sync state; do not build an extension-owned cloud sync service in V1.
- Do not require a second opt-in for non-secret metadata because that would reduce UX value without materially improving token safety.
- UI should explain that labels, preferences, model/workaround choices, notification/status settings, priority order, manual-only flags, and switch-policy preferences may follow the user when platform sync is enabled.
- UI should also explain that Codex auth tokens, generated local API keys, tunnel/runtime state, quota cache, and Usage Statistics do not sync.
- Synced switch-policy preferences should be shown as pending until local matching/authentication makes the referenced Codex Accounts available.
- If platform sync is unavailable, disabled, or unsupported by Cursor, the extension should degrade gracefully and keep the metadata local.
- Sync conflicts should use a mixed policy: last-writer-wins for low-risk scalar preferences, but user-visible review for account-affecting changes such as account matching, labels, priority order, manual-only flags, or switch policy.
- The user should be able to keep a local override when synced metadata is not appropriate for the current extension-host environment.
- Account matching for synced metadata should use privacy-safe stable fingerprints derived from opaque account IDs, not raw email/account IDs in synced state.
