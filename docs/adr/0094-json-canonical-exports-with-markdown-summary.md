# JSON Canonical Exports With Markdown Summary

Status: accepted

Usage Statistics exports and doctor/support reports should use redacted plain JSON as the canonical export format. A human-readable Markdown summary may be generated optionally from the same redacted data for easier review and sharing.

## Consequences

- JSON is the canonical format for support, debugging, tooling, regression tests, and any future import/analysis workflows.
- Markdown summaries are optional convenience output and must be generated from the same redacted JSON data, not from a separate raw source.
- Export UI should make clear whether the user is exporting JSON, Markdown summary, or both.
- Redaction rules apply before both JSON and Markdown generation: no OAuth tokens, refresh tokens, generated local API keys, raw prompts, raw provider payloads, raw account IDs, emails, or unredacted Cursor correlation IDs by default.
- JSON exports should include schema/version metadata so future tooling can parse them safely.
- Markdown summaries should prioritize readable sections such as setup health, account states, quota status, recent errors, switch events, and anonymized Usage Statistics highlights.
- Markdown summaries should not include additional detail that is absent from the redacted JSON export.
- Support bundle logs, when selected, should be redacted and represented consistently in JSON and optional Markdown output.
- If a user chooses an advanced raw-identifier export option, the export UI must clearly mark that choice and keep Markdown generation consistent with the selected redaction scope.
