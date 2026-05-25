# Codex-Specific V1 Language

Status: accepted

V1 documentation and implementation language should be Codex Auth-First by default. Earlier provider-capable terminology remains historical context only and should not shape current V1 naming, UI, package boundaries, or implementation abstractions.

Generic names are appropriate only for infrastructure that is genuinely generic in V1: local API, dashboard, tunnel/public URL, setup, diagnostics, logging, status, and shared runtime mechanics. Codex auth, Codex request adaptation, Codex quota/limit handling, Codex account management, and Codex Usage Statistics should be named as Codex-specific code and product surfaces.

## Consequences

- `CONTEXT.md` should treat Provider as a historical planning term, not active V1 language.
- Current V1 docs should say Codex Auth-First rather than provider-capable or Codex-first.
- Superseded provider ADRs may remain for history, but active ADRs should point to ADR 0021 and avoid suggesting provider cards or scaffolding.
- Implementation should not introduce provider abstractions unless Codex genuinely needs the boundary or a future accepted decision adds another integration.
- Shared infrastructure should stay reusable without pretending V1 has a provider marketplace.
