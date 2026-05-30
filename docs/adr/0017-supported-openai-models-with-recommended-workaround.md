# Supported OpenAI Models With Recommended Workaround

Status: accepted, qualified by ADR-0122

V1 should support the built-in OpenAI-family Cursor models that the extension can handle, rather than hiding everything except one recommended model. Under the current Phase 3 assumption, setup should recommend the direct verified Cursor-facing model path and keep the older GPT-5.4-to-GPT-5.5 Harness Routing Workaround dormant.

## Consequences

- The dashboard/setup flow should distinguish between supported models and recommended models.
- Supported OpenAI-family Cursor-Facing Model IDs may be listed when the API can adapt their request shape and they are expected to preserve Cursor's OpenAI harness.
- The recommended path should be visually prominent and direct while direct Cursor-facing routing is verified.
- Setup should not foreground prompt/model label skew unless the dormant workaround is reactivated.
- Direct `gpt-5.5` may be recommended only while Harness Capture or equivalent evidence proves it reaches the Extension Base URL with the expected request shape.
- `gpt-5.4-mini` and other supported OpenAI-family models may be available as secondary choices, with honest notes about any captured differences or missing evidence.
- The model list should avoid arbitrary `custom` model IDs and non-Codex provider-prefixed aliases because those lose or fail the desired harness behavior.
- The shipped supported model list should be conservative, with a diagnostic Harness Capture mode available to verify routing behavior as Cursor changes.
