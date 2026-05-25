# Greenfield Extension V1

Status: accepted

V1 will be a new, clean extension built from zero rather than a wrapper around the existing Python proxy. The goal is for V1 to already be the best product architecture we can justify with the current evidence, combining the proven protocol behavior from the existing proxy with the stronger extension, dashboard, tunnel, and onboarding ideas found in Ungate.

## Consequences

- The extension should not launch the old Python proxy as its primary architecture.
- The implementation should reuse evidence, request/response semantics, fixtures, and tests from the existing proxy rather than copy its deployment shape.
- Codex protocol behavior remains the correctness baseline: auth refresh, Cursor request adaptation, Responses-shaped input handling, streaming response adaptation, reasoning handling, session identity propagation, and the Harness Routing Workaround must not regress.
- Reasoning display should default to hiding reasoning text from normal chat output while preserving native reasoning metadata for future Cursor support.
- Request/response recording should exist only as an off-by-default diagnostic mode, with raw capture gated for synthetic Harness Capture scenarios.
- Ungate remains a UX and packaging reference: extension shell, local API process, tunnel lifecycle, dashboard/status UI, and multi-window coordination are useful inputs, but its Codex reasoning mapper and private Cursor hacks are not correctness baselines.
- The new codebase should be clean and Codex Auth-First for V1. Shared infrastructure may use generic names only when it is genuinely generic, but V1 should not introduce provider abstractions for hypothetical future integrations.
- Implementation should be phased: prove runtime packaging first, then single-account Codex happy path, then durable setup, then multi-account manual switching, then hard-limit-only auto-switching, with sync/export/advanced policies later.
