# Review-First Temporarily Unusable Accounts

Status: accepted

When a Codex Account appears temporarily unusable because of ambiguous session, challenge, `403`, Cloudflare-like, workspace permission, or account-disabled signals, V1 should not skip that account automatically by default. These signals are less certain than hard quota or auth-invalid states and can indicate broader outages, Cursor/proxy bugs, or session problems that need user review.

## Consequences

- Temporarily unusable signals should mark the Codex Account as `needs review` or `temporarily unusable` rather than quota-limited.
- Default multi-account auto-switching should not skip temporarily unusable accounts unless the user enables an advanced policy for that behavior.
- The dashboard should explain why the account needs review and show the safe signal category/code without raw provider payloads.
- Notifications may alert the user according to preferences, especially when the Active Codex Account becomes temporarily unusable.
- If advanced skip-temporarily-unusable is enabled, switching remains pre-output only, bounded, visible in switch history, and never uses manual-only accounts.
- Usage Statistics should record safe category/code, account state, whether advanced skip was enabled, skipped account if any, fallback account if any, and final serving account.
