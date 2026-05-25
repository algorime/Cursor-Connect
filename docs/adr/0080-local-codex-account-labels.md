# Local Codex Account Labels

Status: accepted

V1 should give each Codex Account a local display label so users can distinguish multiple accounts without exposing email addresses, account IDs, or provider identity strings in compact UI. Default labels should be neutral, such as `Account 1` and `Account 2`, and users should be able to edit them locally.

## Consequences

- Each Codex Account should have a local Codex Account Label stored as non-secret metadata.
- Default labels should be generated in account-add order and avoid email, account IDs, plan names, or provider-derived identity strings.
- Users should be able to rename labels in account management.
- Labels should be used in dashboard account cards, status tooltip, switch history, Usage Statistics, and notifications where identifying the account helps comprehension.
- Labels should sync as non-secret metadata across extension-host environments when platform Settings Sync is enabled and available, but they should apply only after matching a local Codex Account by privacy-safe fingerprint or explicit user confirmation.
- Compact status bar text should still hide account identity by default; showing a label in compact text remains opt-in.
- Labels are local aliases and should not be treated as authenticated identity.
- Usage Statistics exports may include labels by default because they are user-controlled local metadata, but exports should still avoid raw email/account IDs unless explicitly requested through an advanced option.
- Doctor/support reports may also include labels by default for the same reason, while still redacting raw account identity and secrets.
- Export/report UI should make clear that labels are included and let users review or omit them if they typed sensitive text into a label.
- Destructive remove-account-data flows may use the local Codex Account Label for typed confirmation, falling back to a neutral unique label when needed.
- If a label is blank or duplicated, UI should fall back to a neutral unique display such as `Account 2` while letting the user edit it.
