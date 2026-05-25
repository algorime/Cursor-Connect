# Global And Per-Account Usage Clear Export

Status: accepted

V1 Usage Statistics should support both global clear/export and per-account clear/export. Multi-account users need to manage one Codex Account's local history without wiping all other local Usage Statistics, while global controls remain useful for reset, privacy, and support.

## Consequences

- Dashboard should provide clear/export controls for all Usage Statistics.
- Dashboard should also provide clear/export controls scoped to one Codex Account.
- Per-account clear should remove request stats, quota cache metadata, and safe operational records attributable to that Codex Account where practical.
- Cross-account switch-history entries involving a deleted account should be anonymized rather than fully deleted when they are needed to preserve aggregate behavior history.
- Global clear should remove all local Usage Statistics and quota cache records, but should not delete Codex Account auth secrets unless the user chooses logout/account removal separately.
- Logout/disconnect should not clear Usage Statistics by default; remove-account-data should offer an explicit per-account Usage Statistics keep/export/delete choice.
- Export files should identify whether they are global or per-account and should redact secrets, local API keys, raw prompts, raw provider responses, and sensitive identifiers by default.
- Usage Statistics exports should use redacted JSON as the canonical format, with optional Markdown summaries generated from the same redacted data.
- Export files should include local Codex Account Labels by default so multi-account records remain understandable without raw account identity.
- Request IDs, session IDs, Cursor conversation IDs, and similar correlation identifiers should be hashed by default, with raw IDs only behind an explicit advanced export option.
- Clear actions should require confirmation and explain whether auth/accounts remain connected.
- If a remove-account-data flow deletes per-account Usage Statistics, it should require typed confirmation with the local Codex Account Label.
- Anonymized switch-history entries should replace the deleted account with `Removed account` and remove account-specific identifiers and quota details.
- Auto-pruning remains separate from user-initiated clear/export.
