# Supported OpenAI Models With Recommended Workaround

Status: accepted

V1 should support the built-in OpenAI-family Cursor models that the extension can handle, rather than hiding everything except one recommended model. The setup UX should still clearly recommend the proven best path: select Cursor-Facing `gpt-5.4` and enable the Harness Routing Workaround to send requests upstream as `gpt-5.5`.

This recommendation is intentional even though Cursor may label or prompt the request as GPT-5.4. The upstream `gpt-5.5` quality gain is preferred, and the preserved `gpt-5.4` OpenAI-family harness remains close enough to be the best available Cursor path under current evidence.

## Consequences

- The dashboard/setup flow should distinguish between supported models and recommended models.
- Supported OpenAI-family Cursor-Facing Model IDs may be listed when the API can adapt their request shape and they are expected to preserve Cursor's OpenAI harness.
- The recommended path should be visually prominent: `gpt-5.4` in Cursor with the opt-in route to Upstream `gpt-5.5`.
- Setup should disclose that the Cursor harness may still say GPT-5.4 while the extension sends Upstream `gpt-5.5`.
- Direct `gpt-5.5` should be shown as not currently Harness-Routed in this environment unless a future Harness Capture proves otherwise.
- `gpt-5.4-mini` and other supported OpenAI-family models may be available as secondary choices, with honest notes about any captured differences or missing evidence.
- The model list should avoid arbitrary `custom` model IDs and non-Codex provider-prefixed aliases because those lose or fail the desired harness behavior.
- The shipped supported model list should be conservative, with a diagnostic Harness Capture mode available to verify routing behavior as Cursor changes.
