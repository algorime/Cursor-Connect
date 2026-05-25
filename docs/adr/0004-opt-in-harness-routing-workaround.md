# Opt-In Harness Routing Workaround

Status: accepted

V1 will not expose a general manual model-routing system. Instead, the extension will expose a small user-visible setting for the known Cursor routing limitation where `gpt-5.5` does not reach the Extension Base URL, while `gpt-5.4` does preserve the richer Cursor OpenAI-family harness. The setting asks whether to route the Cursor-Facing Model ID `gpt-5.4` to the Upstream Model ID `gpt-5.5`.

The setup UX should strongly recommend this workaround as the best known path: select Cursor-Facing `gpt-5.4` in Cursor and route it to Upstream `gpt-5.5` inside the extension. Upstream `gpt-5.5` quality is preferred even though Cursor may still display and shape the request as GPT-5.4.

The workaround should be first-run prompted and then persisted. It should not silently default on, because Cursor still displays `gpt-5.4` while the extension sends `gpt-5.5` upstream. It should not default off without a prompt, because most users would miss the best known setup.

## Consequences

- The dashboard should explain the known Cursor-side limitation and the workaround in plain language.
- The dashboard should be honest about the prompt/model label skew: Cursor may preserve the `gpt-5.4` harness while Codex receives `gpt-5.5` upstream.
- The workaround should be opt-in or explicitly acknowledged by the user, not hidden as a broad manual rewrite table.
- The first-run experience should recommend the workaround, then remember the user's choice.
- V1 should avoid exposing Azure-era model rewrite complexity unless a future provider has a concrete end-to-end need.
- The model mapping must still be represented internally as Cursor-Facing Model ID to Upstream Model ID, but the UI should present it as a specific workaround rather than a generic routing feature.
