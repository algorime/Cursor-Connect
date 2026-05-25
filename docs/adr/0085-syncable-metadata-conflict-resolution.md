# Syncable Metadata Conflict Resolution

Status: accepted

When Syncable Account Metadata or other non-secret synced preferences conflict across extension-host environments, V1 should use a mixed conflict policy: low-risk scalar preferences may resolve with last-writer-wins, while account-affecting changes require user-visible review before applying.

## Consequences

- Last-writer-wins is acceptable for low-risk scalar preferences such as notification preset, status bar mode, model/workaround preference, and dashboard view preferences.
- Account-affecting conflicts should require explicit review before applying, including Codex Account Labels that appear duplicate or sensitive, account priority order, manual-only flags, and Codex Account Switch Policy changes.
- The user should always be able to keep a local override for the current extension-host environment.
- Conflict UI should explain which environment changed the value when that can be shown safely, without exposing raw account identity or secrets.
- Applying a synced account-affecting preference must not authenticate an account, copy tokens, change runtime state, or clear local account health state.
- Pending synced account metadata should remain pending when account fingerprint matching is ambiguous or when the user chooses not to apply it locally.
- Account-metadata removal tombstones should prompt for local review rather than silently deleting local metadata, auth state, or Usage Statistics in another environment.
- Previously removed account metadata should also require review before restoration when the same account fingerprint appears again.
- Conflict decisions should be recorded as non-secret operational metadata where useful for doctor/support reports, without raw account IDs, OAuth tokens, local API keys, or prompt/provider payloads.
