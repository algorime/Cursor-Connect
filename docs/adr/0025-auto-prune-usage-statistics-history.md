# Auto-Prune Usage Statistics History

Status: accepted

V1 Usage Statistics should not retain local request history indefinitely by default. The extension should auto-prune request-level usage records with a bounded retention policy, while still giving the user manual clear and export controls.

## Consequences

- Default retention should be bounded, such as 30 days or a conservative size cap, with the exact implementation chosen during build.
- Retained records should remain local and should not include prompt bodies by default.
- Dashboard should expose manual clear controls for usage history and quota cache.
- Dashboard should expose export controls for support/debugging before clearing.
- Aggregated summaries may be recomputed from retained request records; do not keep an unbounded shadow history to preserve old aggregates.
- Diagnostic raw captures remain governed by the separate diagnostic recording decision and should not be mixed with normal Usage Statistics retention.
- Extension/API logs should have their own short bounded retention policy and should not be treated as Usage Statistics history.
