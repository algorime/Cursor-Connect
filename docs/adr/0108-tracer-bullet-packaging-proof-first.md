# Tracer-Bullet Packaging Proof First

Status: accepted

Before building full dashboard polish, multi-account automation, sync metadata, rich Usage Statistics, or advanced support/export features, V1 should first prove the extension packaging/runtime architecture with a tracer bullet.

The tracer bullet should validate that the Cursor/VS Code extension can spawn and supervise the separate local API process in the packaged extension environment, bind the persisted random loopback port, authenticate public and internal surfaces correctly, and recover from common restart/repair conditions.

## Consequences

- First implementation milestone should be extension shell plus `apps/api` process launch, not full product UX.
- The tracer bullet must prove `/health` works unauthenticated and `/ready` works only with the generated local API key.
- The tracer bullet must prove the internal control secret is separate from the generated local API key and can authenticate extension-owned internal calls.
- The tracer bullet must prove the API binds to the persisted random `127.0.0.1:<port>` and does not silently change ports on restart.
- The tracer bullet must show clear repair behavior when the persisted port is unavailable.
- The tracer bullet should distinguish launch failure, health failure, readiness failure, and internal-control failure in logs/status.
- Packaging tests should answer whether the extension environment can reliably spawn the bundled API JavaScript without bundling a separate Node runtime.
- Defer rich dashboard, multi-account auto-switching, sync metadata, auth transfer, advanced Usage Statistics exports, and support bundles until this runtime proof succeeds.
- After this tracer bullet, the next phase should be a single Codex Account happy path before multi-account manual switching and hard-limit-only auto-switching.
