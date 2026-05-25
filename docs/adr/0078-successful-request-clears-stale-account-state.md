# Successful Request Clears Stale Account State

Status: accepted

When a user manually switches to a Codex Account marked `limited`, `temporarily unusable`, or `needs review`, a successful real request should clear that stale bad state. The successful request proves the account can currently serve traffic. This recovery should not change the user's account policy preferences.

## Consequences

- A successful request can clear `limited`, `temporarily unusable`, or `needs review` state for that Codex Account.
- A fresh quota response showing the account is allowed can also clear `limited` state.
- Auth/session repair can clear `auth required` or session-related unusable state.
- Clearing a bad runtime state must not change whether the account is manual-only.
- Clearing a bad runtime state must not add the account to auto-switch eligibility if the user excluded it by policy.
- Clearing a bad runtime state must not reorder account priority.
- Dashboard/status should show the account as recovered while preserving its configured policy labels.
- Usage Statistics and switch history should record that the manual request or quota refresh proved recovery.
