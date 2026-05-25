# Account Priority Order For Auto-Switching

Status: accepted

When multiple Codex Accounts are eligible after a hard limit or configured switch trigger, V1 should choose the next account using a user-configured priority order. By default, the priority order should be the order accounts were added.

## Consequences

- The account management UI should show auto-switch priority order.
- Advanced users should be able to reorder accounts.
- Accounts can be marked manual-only so auto-switching skips them while still allowing explicit manual selection.
- The dashboard should make eligibility visible: active, eligible for auto-switch, manual-only, limited, auth error, or unavailable.
- Switch history should record the priority decision, skipped accounts, and final selected account.
- If no eligible non-manual-only account is available, the local API should return a clear error rather than using a manual-only account silently.
- Manual-only accounts should be shown separately from blocked accounts; they are skipped by policy, not blocked by quota/auth/error unless they also have that state.
