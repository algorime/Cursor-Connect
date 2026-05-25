# Account Metadata Removal Tombstones

Status: accepted

When a user removes Codex Account data in one extension-host environment, V1 should sync a non-secret removal tombstone for Syncable Account Metadata tied to that account fingerprint. The tombstone should not silently delete auth secrets, Usage Statistics, quota history, or runtime-local state in other environments.

## Consequences

- Remove-account-data may publish a non-secret `forget this account metadata` tombstone for the account fingerprint through platform Settings Sync.
- The tombstone applies only to Syncable Account Metadata such as labels, priority order entries, manual-only flags, and switch-policy references for that account.
- A tombstone must not delete OAuth tokens, imported Codex CLI token material, generated local API keys, local Usage Statistics, quota cache, diagnostic data, or runtime state in another environment.
- Other environments should show a review prompt such as `Account metadata was removed elsewhere. Remove local metadata too?` rather than silently deleting local data.
- The review prompt should offer keep local metadata, remove local metadata, and dismiss/decide later when safe.
- If an environment has local auth secrets for the account, the prompt should make clear that removing metadata is separate from logout/disconnect.
- Tombstones should be non-secret, fingerprint-scoped, and should not include raw account IDs, emails, OAuth tokens, local API keys, prompts, or provider payloads.
- Tombstones that affect switch-policy references should put those references into pending/review rather than silently reshaping account priority or eligibility.
- Tombstone conflicts should follow the Syncable Metadata conflict policy: avoid surprise data loss and let the local environment keep an override.
- If the same account fingerprint signs in again later, previous metadata should be restored only after user review, not automatically.
