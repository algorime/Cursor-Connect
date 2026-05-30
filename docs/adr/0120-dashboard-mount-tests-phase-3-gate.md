# Dashboard Mount Tests Phase 3 Gate

Status: accepted

Phase 3 cannot be declared complete while the dashboard mount test path is red, flaky, or producing unhandled lifecycle errors. The Dashboard is the primary setup surface, so automated proof that first visible content mounts deterministically is part of the polished-surface bar rather than optional test hygiene.

## Consequences

- Root `test` must pass before Phase 3 is marked ready for Phase 4.
- Dashboard mount tests should prove visible loading/fallback content appears immediately and that setup state can render without unhandled Svelte errors.
- If a mount failure is test-harness-specific, the fix should make teardown/import/interval handling deterministic rather than hiding the problem with a broad timeout increase.
- Raising a timeout is acceptable only when evidence shows cold transforms are the dominant cost and no lifecycle errors remain.
- A manually working dashboard does not override red automated mount evidence for Phase 3 readiness.
