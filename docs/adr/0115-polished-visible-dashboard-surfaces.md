# Polished Visible Dashboard Surfaces

Status: accepted

Visible dashboard pages in V1 must be polished for their current scope rather than shipped as skeletons, placeholders, or raw control dumps. Future dashboard areas should stay hidden until they can present clear purpose, strong hierarchy, complete states, plain-language copy, explicit actions, privacy-safe defaults, and responsive layout; this deliberately rejects the faster path of exposing every planned surface early and polishing later.

## Consequences

- Phase 3 dashboard work should include only pages that can meet the polished bar, such as Home, Setup, Diagnostics, and Preferences.
- Future Usage, Accounts, Logs, and Support sections may appear as disabled polished navigation affordances with clear `Later` labels, but they must not route to placeholder pages until they are intentionally designed and useful.
- Developer-only raw state, raw doctor markdown, and large undifferentiated button grids are not acceptable as primary user-facing UI.
- Existing dashboard contracts may expose many actions, but the UI must group and prioritize them rather than displaying all actions equally.
