# Codex Auth-First V1

Status: accepted

V1 should fully focus on Codex/ChatGPT subscription usage and authentication. Earlier provider-capable language is no longer the V1 product direction: do not build or display non-Codex providers in V1, even as Coming-Soon Provider cards.

## Consequences

- V1 product scope is Codex auth, multi-account Codex setup, Codex request/response correctness, Codex usage statistics, tunnel/API lifecycle, and Cursor setup guidance.
- The dashboard should not include Claude, Azure, MiniMax, generic OpenAI-compatible, or other provider cards in V1.
- Shared infrastructure should be named around its actual role, such as local API, dashboard, tunnel, setup, model support, auth, diagnostics, and usage stats, rather than speculative provider abstractions.
- Codex-specific behavior should be named Codex-specific: Codex auth, Codex request/response adaptation, Codex quota/limit handling, Codex account management, and Codex Usage Statistics.
- Future provider support can be reconsidered later only after a new decision and harness evidence, but it should not shape V1 implementation complexity.
- This reinforces the harness findings: non-Codex/custom-provider paths are likely to lose the richer Cursor OpenAI-family harness and worsen UX/performance.
- Although the product direction includes multi-account Codex support and Usage Statistics, implementation should phase toward it from a single-account happy path rather than building all advanced account/sync/export features before the core proxy works.
