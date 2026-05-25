# Promote Direct GPT-5.5 When Harness-Routed

Status: accepted

The likely future routing change is Cursor adding working custom Base URL routing for built-in `gpt-5.5`, not built-in `gpt-5.4` suddenly losing routing. V1 should therefore treat direct Cursor-Facing `gpt-5.5` support as the intended migration path once a fresh Harness Capture proves it reaches the Extension Base URL with an acceptable OpenAI-family harness.

The current `gpt-5.4` to `gpt-5.5` Harness Routing Workaround remains the recommended setup until that proof exists. It should not become a permanent product concept after direct `gpt-5.5` routing works.

## Consequences

- If a future Harness Capture proves built-in `gpt-5.5` reaches the Extension Base URL, V1 should promote direct `gpt-5.5` setup and stop recommending the `gpt-5.4` workaround for new setup.
- Existing users with the workaround can be offered a guided migration: switch Cursor to `gpt-5.5`, disable the workaround, verify `/ready` and a synthetic Harness Capture, then mark setup healthy.
- If direct `gpt-5.5` routing is not verified, keep recommending `gpt-5.4` to upstream `gpt-5.5`.
- Do not add `custom` as a fallback for this path; `custom` remains diagnostic only because it loses the richer OpenAI-family harness.
- The model setup UI should show routing status as evidence-based: `verified direct`, `workaround recommended`, or `not verified`.
- Diagnostic Harness Capture remains the authority for changing model recommendations when Cursor routing behavior changes.
