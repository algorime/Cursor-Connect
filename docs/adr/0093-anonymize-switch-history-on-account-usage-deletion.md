# Anonymize Switch History On Account Usage Deletion

Status: accepted

When a user deletes per-account Usage Statistics for a Codex Account, V1 should anonymize cross-account switch-history entries involving that account rather than deleting every event. This preserves aggregate behavior history while respecting the user's deletion choice for account-specific data.

## Consequences

- Per-account Usage Statistics deletion should remove request records, quota-cache details, and account-specific usage fields for that Codex Account according to the chosen delete scope.
- Switch-history entries involving the deleted account may remain only in anonymized form when they are useful for aggregate system history.
- The deleted account should be represented as `Removed account` instead of retaining its Codex Account Label, fingerprint, raw account ID, email, or other account-specific identifier.
- Safe retained switch-history fields may include timestamp, switch reason/category, source/target role, whether the switch was automatic/manual/pre-stream retry/next-request, and success/failure outcome.
- Account-specific quota details, account labels, fingerprints, raw IDs, emails, and per-account token/usage details for the deleted account should be removed from retained switch-history entries.
- If both sides of a switch event are deleted or anonymized, the event may remain as an aggregate operational event only if it still provides value without account identity.
- Exports and dashboard timelines should clearly label anonymized entries as involving a removed account.
- Global Usage Statistics deletion can still delete all switch history when the user chooses a full local usage reset.
