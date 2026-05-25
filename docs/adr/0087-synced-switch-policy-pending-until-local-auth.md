# Synced Switch Policy Pending Until Local Auth

Status: accepted

When a Codex Account Switch Policy syncs to a new extension-host environment, it should remain pending or incomplete until the referenced Codex Accounts exist and are authenticated locally. Syncing the policy preference must not make unauthenticated or partially matched accounts eligible for automatic switching.

## Consequences

- Sync may carry the user's preferred Codex Account Switch Policy, account priority order, and manual-only flags as non-secret metadata.
- The policy becomes active only after the referenced Codex Accounts are present in the current extension-host environment and authenticated locally.
- Partially matched accounts, pending fingerprints, missing accounts, and unauthenticated accounts must not be used for automatic switching.
- Dashboard/account management should show states such as `policy synced, needs local accounts/auth` so the user understands why the synced policy is not active yet.
- The setup/account-management UI should guide the user to sign in, import, or manually match accounts before activating a synced policy.
- If only part of the synced policy can be matched safely, the UI should ask for review rather than silently dropping or reordering accounts.
- If a referenced Codex Account was removed locally or has a synced removal tombstone, the policy reference should become pending/review rather than being silently removed or replaced.
- Activating a synced policy must still respect local account health: auth-required, limited, temporarily unusable, and manual-only states remain local eligibility checks.
- Usage Statistics and switch history should record only locally active policy decisions, not pending synced policy preferences as if they routed traffic.
