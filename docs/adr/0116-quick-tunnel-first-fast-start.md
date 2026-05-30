# Quick Tunnel First Fast Start

Status: accepted

Phase 3 should make Quick Tunnel the default first-run path because the extension can start and manage it, while a Durable Extension Base URL currently requires user-owned external infrastructure. Durable Extension Base URLs remain the preferred stable end-state, but the dashboard should present them as the recommended stable path rather than the primary fast-start path until the extension can provision or manage durable public routing itself.

## Consequences

- The Home next action should prefer starting or repairing Quick Tunnel when no verified Extension Base URL exists and Quick Tunnel is available.
- The Setup page should show Quick Tunnel as the fastest default setup path and label it temporary/testing with URL-change risk.
- Starting or restarting Quick Tunnel should automatically verify the returned URL through the same `/health` plus authenticated `/ready` checks and make it the current temporary Extension Base URL when verification succeeds.
- If Quick Tunnel verification fails, the dashboard should show the tunnel URL and failure reason without presenting it as Cursor-ready.
- The Setup page should show Durable Extension Base URL as the stable path, with clear forwarding instructions to the current extension-host local target.
- Cursor setup copy must clearly indicate whether the currently verified Extension Base URL is temporary Quick Tunnel or durable user-owned routing.
- Doctor should continue to warn when Quick Tunnel is active because streaming support and URL durability remain weaker than a Durable Extension Base URL.
- ADR-0098 still applies to the stable end-state, but no longer means durable user-owned URL is the default first-run CTA for Phase 3.
