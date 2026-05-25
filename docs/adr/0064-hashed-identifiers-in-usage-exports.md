# Hashed Identifiers In Usage Exports

Status: accepted

Usage Statistics exports should hash request IDs, session IDs, Cursor conversation IDs, and similar correlation identifiers by default. Stable local hashes preserve support/debug correlation without exposing raw identifiers unnecessarily.

Raw identifiers may be included only through an explicit advanced export option when the user knowingly wants support-level correlation.

## Consequences

- Default exports should include stable hashes for request/session/conversation identifiers instead of raw values.
- Hashing should be stable within the export or local installation so related records can still be correlated.
- Raw IDs should require an explicit advanced option with clear warning text.
- Export UI should explain that hashes help correlate records without exposing raw identifiers.
- JSON exports should include schema/version metadata and hashed identifiers by default; optional Markdown summaries should be generated from the same redacted JSON data.
- Exports should continue to redact secrets, OAuth tokens, local API keys, raw prompts, raw provider responses, and sensitive account identifiers by default.
- Exports may include local Codex Account Labels by default because they are user-controlled aliases, not raw sensitive account identifiers.
- Diagnostic raw captures remain a separate explicit mode; enabling raw ID export does not imply raw body capture.
- Doctor/support exports should follow the same default hashed-ID policy.
