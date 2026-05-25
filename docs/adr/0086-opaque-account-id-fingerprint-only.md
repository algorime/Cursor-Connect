# Opaque Account ID Fingerprint Only

Status: accepted

Syncable Account Metadata should auto-match across extension-host environments only when the extension can derive a privacy-safe fingerprint from a stable opaque Codex/ChatGPT account ID. V1 should not derive account fingerprints from email addresses.

## Consequences

- Fingerprint input should be a stable opaque Codex/ChatGPT account identifier available after local authentication/import, not an email address, display name, plan name, or provider label.
- The synced fingerprint should be a deterministic namespaced hash so synced metadata can match the same Codex Account across environments without storing the raw account ID.
- Email must not be used as fingerprint input because it is personal, may change, and would make synced metadata easier to correlate with a real identity.
- If a stable opaque account ID is unavailable, synced metadata should remain pending and the UI should ask the user to confirm any match manually.
- Manual matching still does not authenticate the target environment, copy tokens, or prove ownership; it only applies non-secret labels/preferences to a local Codex Account.
- Ambiguous manual matches should remain unresolved until the user chooses a target account or dismisses the pending metadata.
- Export/support reports should treat account fingerprints as correlation identifiers and avoid raw account IDs and emails by default.
