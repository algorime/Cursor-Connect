# Account Labels In Exports And Support Reports

Status: accepted

Usage Statistics exports and doctor/support reports should include local Codex Account Labels by default. Labels are user-controlled local metadata, so including them makes multi-account records understandable without exposing raw email addresses, account IDs, or provider-derived identity strings.

## Consequences

- Default exports should include Codex Account Labels for account-attributed records, switch history, quota snapshots, and account health summaries.
- Default doctor/support reports should include Codex Account Labels when they help explain account state, readiness, switching, or quota issues.
- Raw email addresses, account IDs, session identifiers, provider account names, OAuth tokens, local API keys, prompts, and provider payloads remain redacted by default.
- Advanced export options may include raw identifiers only after explicit warning and user confirmation.
- Labels should be treated as user-controlled local metadata, not authenticated identity.
- If a label itself contains sensitive text because the user typed it, export/report UI should warn that labels are included by default and provide a way to review or omit them.
