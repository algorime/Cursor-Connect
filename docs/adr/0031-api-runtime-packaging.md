# API Runtime Packaging

Status: accepted

V1 should ship the local API as bundled JavaScript and should not bundle a separate full Node runtime unless packaging tests prove it is required. The default posture is to spawn the bundled API using the Node/runtime path available to the extension environment.

## Consequences

- Build `apps/api` into a production JavaScript bundle suitable for spawning from `apps/extension`.
- The API bundle should update through normal extension updates, not through a separate runtime auto-updater.
- Avoid adding a separate Node runtime to the extension package by default because it increases package size, platform matrix complexity, and update surface.
- Runtime resolution should be explicit and tested during packaging; if Cursor/VS Code distribution constraints prevent a reliable spawned API, revisit this decision with evidence.
- Runtime resolution must be proven by an early tracer bullet before full dashboard, multi-account, sync, or Usage Statistics polish.
- API process logs/readiness/errors should clearly distinguish runtime launch failures from API health failures.
- Native dependencies should be avoided in the API process where practical to keep packaging simple, including preferring pure JS/WASM SQLite for Usage Statistics if it satisfies V1 needs.
