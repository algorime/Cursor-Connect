# Manual-Only Accounts Separated From Blocked Status

Status: accepted

When automatic account switching cannot find an eligible Codex Account, V1 should distinguish blocked automatic accounts from manual-only accounts. Manual-only accounts are not blocked; they are intentionally excluded from automatic use and remain available only if the user explicitly switches to them.

## Consequences

- Errors to Cursor should say no eligible automatic Codex Account is available when manual-only accounts exist but cannot be auto-used.
- Manual-only accounts should appear separately in dashboard/status as manually available, not limited/auth-broken/unusable unless they also have that state.
- Manual-only accounts should not count as blocked automatic accounts and should not affect earliest reset calculations for blocked automatic accounts.
- The dashboard should offer an explicit manual switch action when a manual-only account could serve the request.
- Usage Statistics should record manual-only accounts as skipped by policy, not blocked by quota/auth/error.
- Auto-switching must never silently use a manual-only account, even when every automatic account is blocked.
