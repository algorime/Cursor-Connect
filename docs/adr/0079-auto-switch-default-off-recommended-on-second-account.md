# Auto-Switch Default Off, Recommended On Second Account

Status: accepted

Adding a second Codex Account should not silently enable automatic account switching. V1 should keep auto-switching off until the user explicitly enables a Codex Account Switch Policy, while strongly recommending the conservative hard-limits-only policy during second-account setup.

## Consequences

- The first additional Codex Account flow should explain why auto-switching exists and what it changes.
- The recommended policy should be hard-limits-only, using the conservative signal classification already defined for V1.
- The user should make an explicit choice: enable recommended hard-limits-only switching, configure advanced policy, or keep manual switching only.
- The default after adding a second account remains no automatic use of the new account unless the user chooses it.
- The setup/account-management UI should avoid surprising account use while still nudging users toward the continuity benefit of multi-account support.
- If the user declines auto-switching, the account can still be manually selected and may still appear in Usage Statistics, quota views, and account management.
- Usage Statistics and switch history should clearly distinguish manual switching from automatic switching enabled through this setup step.
