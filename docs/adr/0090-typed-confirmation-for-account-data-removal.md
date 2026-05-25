# Typed Confirmation For Account Data Removal

Status: accepted

Remove-account-data is more destructive than logout/disconnect and should require stronger confirmation, especially when it deletes per-account Usage Statistics. Logout/disconnect may use a normal confirmation because it only removes auth secrets and keeps local context.

## Consequences

- Logout/disconnect should require a clear confirmation, but it should not require typing the account label because it preserves non-secret metadata and Usage Statistics.
- Remove-account-data should require stronger confirmation because it can delete labels, synced metadata references, account policy entries, quota history, and local account context.
- If remove-account-data includes deleting per-account Usage Statistics, the user should type the local Codex Account Label to confirm.
- The confirmation UI should clearly separate the available choices: keep Usage Statistics, export first, or delete Usage Statistics.
- If the Codex Account Label is blank, duplicate, or unavailable, the UI should use the current neutral display label such as `Account 2` for typed confirmation.
- The confirmation should explain that auth secrets, non-secret metadata, and Usage Statistics have separate deletion scopes.
- Typed confirmation should not expose raw account IDs or email addresses; use local Codex Account Labels only.
- Removal events may be recorded as non-secret operational metadata, but must not include OAuth tokens, local API keys, raw prompts, raw provider payloads, raw account IDs, or emails.
