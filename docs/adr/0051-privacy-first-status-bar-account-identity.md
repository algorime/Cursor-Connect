# Privacy-First Status Bar Account Identity

Status: accepted

The compact status bar should not show Codex Account email, account name, or other sensitive account identity by default. It should prioritize state and limits, such as `Codex: Ready`, `Codex: Limited`, or a compact quota indicator.

Account identity belongs in the tooltip and dashboard by default, with an opt-in setting for users who want a short account label in the status bar.

## Consequences

- Default compact status bar text should avoid email addresses, account names, full account IDs, and other identifying strings.
- Tooltip/dashboard may show account identity because those surfaces are intentional inspection points.
- Users may configure a short label per Codex Account and opt into showing it in the status bar.
- Short labels should be user-controlled aliases, not raw email/account IDs by default.
- Default labels should be neutral local aliases such as `Account 1` and `Account 2`, not provider-derived identity.
- Dashboard, tooltip, switch history, Usage Statistics, and notifications may use local labels to keep multi-account state understandable without exposing raw identity.
- Multi-account state should still be understandable through non-identifying compact states, such as active/limited/switching/manual-only indicators.
- The dashboard remains the source of truth for full account identity, quota windows, priority order, and switch policy.
