# Direct Model Path And Auth Route Visibility

Status: accepted

Cursor's direct model routing issue that made the GPT-5.4-to-GPT-5.5 Harness Routing Workaround necessary is no longer the normal Phase 3 setup assumption. Phase 3 should default to the direct verified Cursor-facing model path and keep the old workaround dormant as a fallback/diagnostic escape hatch rather than a first-run setup decision.

Auth state and public route/tunnel state are the most important user-facing setup facts. The dashboard must make them much more visible and understandable than secondary compatibility choices, because users cannot reason about setup if they cannot quickly tell whether Codex auth is available and whether Cursor can reach the current extension-host runtime.

## Consequences

- The Harness Routing Workaround is disabled by default and hidden from the normal first-run setup path.
- Ready Setup no longer requires an explicit Harness Routing Workaround enable/skip decision.
- The dormant workaround may remain in code and diagnostics as a future fallback, but it should not be presented as the recommended model path unless fresh Harness Capture evidence shows direct routing regressed.
- Normal setup copy should recommend the current direct verified Cursor-facing model path rather than GPT-5.4 routed upstream to GPT-5.5.
- The dashboard Home and Setup surfaces should elevate Codex auth status and Public Route/Quick Tunnel status above model-routing compatibility details.
- Auth and route visibility should be concrete: show current state, what was verified, whether the route is durable or temporary, what is blocking copy/readiness, and the next direct action.
- Doctor should still report model routing/workaround state as compatibility information, but it is not a normal Ready blocker while the workaround is dormant.
