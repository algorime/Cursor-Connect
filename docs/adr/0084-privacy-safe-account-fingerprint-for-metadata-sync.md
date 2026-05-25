# Privacy-Safe Account Fingerprint For Metadata Sync

Status: accepted

Synced non-secret account metadata should match Codex Accounts across extension-host environments using a privacy-safe stable fingerprint, not raw email addresses, account IDs, or provider account names. Raw account identity remains local to authenticated hosts and should not be part of Syncable Account Metadata by default.

## Consequences

- The synced metadata record should use a stable account fingerprint for matching.
- The fingerprint should be derived only from a stable opaque Codex/ChatGPT account ID available after local authentication/import, not from email addresses or display names.
- The synced value should be a deterministic namespaced hash that does not reveal the raw account ID.
- Raw email, account ID, provider account name, OAuth tokens, generated local API keys, and transfer payloads must not be stored in synced global state.
- When a host signs in or imports a Codex Account, it can compute the same fingerprint locally and apply matching synced labels/preferences.
- If no local account matches, or if no stable opaque account ID is available, synced metadata may remain pending without making the target environment authenticated.
- Manual matching may apply non-secret metadata to a local Codex Account, but it does not authenticate the target environment, copy tokens, or prove ownership.
- If multiple local accounts could match or matching is otherwise ambiguous, the UI should ask the user rather than guessing.
- If synced metadata conflicts after a fingerprint match, account-affecting changes should follow the explicit review policy in `0085-syncable-metadata-conflict-resolution.md` rather than silently overwriting local account behavior.
- Fingerprints are for metadata matching only; they are not authentication, authorization, or proof of account ownership.
- Export/support-report behavior should still treat fingerprints as correlation identifiers and avoid raw account identity by default.
