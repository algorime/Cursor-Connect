# Review Before Restoring Removed Account Metadata

Status: accepted

If a user removes Codex Account data and later signs into the same Codex Account again, V1 should not silently restore old synced labels or preferences even when the privacy-safe fingerprint matches. The extension should show a review prompt before applying previous Syncable Account Metadata.

## Consequences

- After sign-in/import, if the account fingerprint matches previously removed or pending synced metadata, the dashboard should show a prompt such as `We found previous metadata for this account. Restore label/preferences?`.
- The default reviewed action may restore low-risk metadata such as Codex Account Label and harmless display/preferences.
- Account-affecting metadata should require explicit review before restoration, including Codex Account Switch Policy, manual-only flag, and priority order.
- Restoring metadata must not restore auth tokens, local API keys, Usage Statistics, quota cache, diagnostic captures, runtime state, or tunnel state.
- Restore decisions should respect removal tombstones: a tombstone should not be ignored silently just because the same fingerprint signs in again.
- The user should be able to keep the new account as fresh, restore selected metadata, or dismiss and decide later.
- If metadata was removed due to suspected exposure or confusion, the review UI should make clear that restoring it is optional and non-authenticating.
- Restoration decisions may be recorded as non-secret operational metadata for doctor/support reports, without raw account IDs, email addresses, OAuth tokens, local API keys, prompts, or provider payloads.
