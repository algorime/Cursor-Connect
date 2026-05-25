# Removed Account Switch Policy Cleanup

Status: accepted

When a Codex Account is removed, any local or synced Codex Account Switch Policy that references it should be downgraded to pending or review before it can affect routing again. Removing an account must not silently reshape automatic switching behavior around the remaining accounts.

## Consequences

- Remove-account-data should immediately remove the Codex Account from local active automatic switching eligibility.
- Any local active Codex Account Switch Policy that referenced the removed account should be marked incomplete or needs review.
- Any synced switch-policy metadata referencing the removed account fingerprint should become pending/review when applied in that environment.
- The extension should not silently reorder remaining accounts, promote another account, or enable a different switch policy shape without user review.
- Dashboard/account management should explain that the policy references a removed account and offer explicit actions: review policy, remove reference, reorder accounts, disable auto-switching, or keep pending.
- Cursor request handling should treat policies in pending/review state as inactive for automatic switching.
- Usage Statistics and switch history should record the account-removal policy transition as non-secret operational metadata where useful, without raw account IDs, OAuth tokens, local API keys, prompts, or provider payloads.
