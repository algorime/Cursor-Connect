# Aggregate-First Rich Usage Dashboard

Status: accepted

Usage Statistics should default to a rich aggregate overview across all Codex Accounts, while clearly highlighting the Active Codex Account. UX and UI quality are important: multi-account usage should feel understandable at a glance, not like a raw table of counters.

## Consequences

- The default usage view should show all-account health first: total requests, recent errors, token totals, cache hit behavior, reasoning tokens, latency, and quota health across accounts.
- The Active Codex Account should be visually prominent because it will serve the next request unless a switch policy changes it.
- Per-account cards should show account identity, status, quota windows, allowed/limited state, last refresh/stale state, recent usage, and whether the account is eligible for auto-switching or manual-only.
- Per-account cards and timelines should use local Codex Account Labels by default, with full email/account identity reserved for intentional account-management details.
- Switch events should be visible in the usage timeline/history with reason, source account, target account, and whether the switch happened pre-stream retry, next-request switch, manual switch, or threshold policy.
- If a referenced account's Usage Statistics were deleted, switch events should show `Removed account` rather than retaining that account's label or fingerprint.
- Switch events should also feed status/notification surfaces when configured, while never being injected into Cursor chat content.
- Users should be able to drill into one account without losing the aggregate context.
- The dashboard should avoid spend/cost widgets and focus on subscription limits, token/debug metrics, cache efficiency, account health, and actionable setup/runtime state.
- The UI should prefer clear visual hierarchy, rich status surfaces, and useful empty/error states over exposing raw implementation details first.
