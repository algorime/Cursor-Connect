# Manual Switching To Flagged Codex Accounts

Status: accepted

Users should be allowed to manually switch the Active Codex Account to a Codex Account that is marked `limited` or `temporarily unusable`, but only after a clear warning and confirmation. Users should not be allowed to switch to an account marked `auth required` until they reauthenticate or repair that account.

## Consequences

- Manual switching is a user override, not an automatic eligibility signal.
- Selecting a `limited` account should warn that the next request may fail immediately unless the limit has reset.
- Selecting a `temporarily unusable` or `needs review` account should warn that the next request may fail due to session, permission, challenge, or account-state issues.
- Selecting an `auth required` account should route the user to reauthentication/repair instead of making it Active.
- Manual switch should change the Active Codex Account for future requests, subject to the account being usable at request time.
- Manual switch should not clear the underlying `limited`, `temporarily unusable`, or `needs review` state by itself.
- A flagged account state should clear only after a successful request, fresh quota showing it is allowed, or auth/session repair proving recovery.
- If a manually selected flagged account successfully serves a real request, that success should clear the stale flagged state, but it must not change manual-only status, auto-switch eligibility, or priority order.
- Auto-switch policy should continue to respect manual-only and flagged states; manual selection does not make the account automatically eligible for future auto-switch use unless the user separately changes policy.
- Dashboard/status should make manual override state visible so users understand they intentionally selected a risky account.
- Usage Statistics and switch history should record manual switch source, prior account state, warning confirmation, final serving account, and whether the next request proved recovery.
