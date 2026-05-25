# Logout Versus Remove Account Data

Status: accepted

V1 should distinguish logging out or disconnecting a Codex Account from removing that account's local data. Logout deletes auth secrets and marks the account `auth required`, while preserving non-secret context so the user can reauthenticate later without losing labels, history, or setup continuity.

## Consequences

- Logout/disconnect deletes the Codex Account's OAuth access tokens, refresh tokens, ID tokens, and imported Codex CLI token material from SecretStorage.
- Logout/disconnect should mark the Codex Account `auth required` and remove it from automatic eligibility until reauthentication or repair.
- Logout/disconnect should keep local non-secret metadata by default: Codex Account Label, account fingerprint, setup preferences, manual-only flag, priority order, switch-policy references, quota history, Usage Statistics, and switch history.
- Keeping non-secret metadata after logout helps users reauthenticate the same account and preserve multi-account context.
- A separate remove-account-data action should delete non-secret account metadata and synced metadata references for that Codex Account after confirmation.
- Remove-account-data may sync a non-secret removal tombstone for Syncable Account Metadata tied to the account fingerprint, but other environments must review before deleting local metadata.
- Remove-account-data should offer a clear choice for per-account Usage Statistics: keep history, export first, or delete the account's local Usage Statistics.
- If remove-account-data deletes per-account Usage Statistics, the user should type the local Codex Account Label to confirm; logout/disconnect only needs normal confirmation.
- Remove-account-data should downgrade any local or synced Codex Account Switch Policy references to the removed account into pending/review instead of silently reshaping automatic switching.
- Removing account data should not delete global Usage Statistics for other accounts, local API keys, tunnel settings, or unrelated synced preferences.
- If a removed account later signs in again, it should be treated as a new local account unless a privacy-safe fingerprint match and user review allow restoring selected previous synced metadata.
- Dashboard, doctor, exports, and support reports should describe whether an account is logged out/auth-required versus removed, without exposing tokens or raw account identity.
