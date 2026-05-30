# Opt-In Harness Routing Workaround

Status: accepted, dormant by ADR-0122

V1 will not expose a general manual model-routing system. The extension keeps a dormant, diagnostic Harness Routing Workaround for the former Cursor routing limitation where `gpt-5.5` did not reach the Extension Base URL while `gpt-5.4` preserved the richer Cursor OpenAI-family harness. The dormant setting can route the Cursor-Facing Model ID `gpt-5.4` to the Upstream Model ID `gpt-5.5` if direct routing regresses.

The normal setup UX should not recommend or require this workaround while direct Cursor-facing model routing is verified. The workaround should stay disabled by default and hidden from first-run setup, with diagnostics able to mention it as a fallback only if direct routing regresses.

## Consequences

- The normal dashboard should not surface the workaround as a setup requirement while direct routing is verified.
- If diagnostics expose the dormant workaround, they should explain the historical Cursor-side limitation and the prompt/model label skew in plain language.
- The workaround should remain opt-in or explicitly acknowledged if it is reactivated, not hidden as a broad manual rewrite table.
- The first-run experience should recommend the direct verified model path, not the dormant workaround.
- V1 should avoid exposing Azure-era model rewrite complexity unless a future provider has a concrete end-to-end need.
- The model mapping must still be represented internally as Cursor-Facing Model ID to Upstream Model ID, but the UI should present it as a specific workaround rather than a generic routing feature.
