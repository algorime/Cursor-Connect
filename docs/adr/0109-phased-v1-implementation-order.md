# Phased V1 Implementation Order

Status: accepted

The docs define a broad Codex Auth-First V1, but implementation should proceed in phases so the first usable build proves the core path before advanced subsystems. Advanced decisions remain accepted product direction, but they should not block the first end-to-end Codex proxy build.

## Consequences

- Phase 1: runtime tracer bullet. Prove extension shell, `apps/api` process launch/supervision, persisted random loopback port, `/health`, authenticated `/ready`, internal control secret, and restart/repair behavior.
- Phase 2: single Codex Account happy path. First create protocol fixtures for captured Cursor requests and representative Codex Responses SSE behavior, then implement built-in OAuth and explicit `~/.codex/auth.json` import fallback, SecretStorage token storage, extension-owned refresh, private auth handoff, Codex request adaptation, supervised streaming response adaptation, reasoning display default, and minimal safe Usage Statistics.
- Phase 3: durable setup path. Implement generated local API key, durable user-owned public URL verification, temporary Quick Tunnel path, Cursor setup checklist, recommended model/workaround setup, status bar basics, and doctor checks.
- Phase 4: multi-account manual switching. Add multiple Codex Accounts, labels, per-account auth state, manual Active Codex Account switching, per-account Usage Statistics attribution, and account management UI.
- Phase 5: hard-limit-only pre-stream auto-switching. Add structured Codex limit classification, pre-output stream supervision, hard-limit account switching, transient same-account retry, switch history, and targeted limited-account refresh.
- Later phases: syncable metadata, auth transfer, removal tombstones, advanced switch policies, temporarily-unusable advanced skip, rich Usage Statistics exports, support bundles, and advanced dashboard polish.
- Build planning should treat each phase as independently demonstrable and should not start broad polish before the prior phase works end-to-end.
