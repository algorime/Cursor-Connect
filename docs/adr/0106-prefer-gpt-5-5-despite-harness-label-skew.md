# Prefer GPT-5.5 Despite Harness Label Skew

Status: accepted

V1 should recommend routing Cursor-Facing `gpt-5.4` to Upstream `gpt-5.5` as the best known model-quality path, even though Cursor's captured harness may still label or prompt the request as GPT-5.4.

The mismatch is not ideal, but it is acceptable because `gpt-5.4` and `gpt-5.5` are same-family OpenAI/Codex models and the upstream `gpt-5.5` quality gain is more important than exact 1:1 harness labeling. Direct Cursor-Facing `gpt-5.5` is still not a working path until a future Harness Capture proves it reaches the Extension Base URL.

## Consequences

- The recommended setup remains: select `gpt-5.4` in Cursor, then enable the Harness Routing Workaround to send the request upstream as `gpt-5.5`.
- Setup copy should be honest: Cursor may display and shape the request as `gpt-5.4`, while the extension sends it to Codex as `gpt-5.5`.
- The workaround should be strongly recommended during first-run setup because upstream `gpt-5.5` is preferred 100% for quality under the current evidence.
- This is still a specific known workaround, not a general manual model-routing UI.
- If a future Harness Capture proves direct `gpt-5.5` reaches the Extension Base URL with a good harness, V1 can stop recommending the `gpt-5.4` route workaround.
- The expected future migration is direct built-in `gpt-5.5` routing becoming Harness-Routed, not falling back to `custom`.
- Diagnostic docs should preserve the evidence: built-in `gpt-5.4` is Harness-Routed, direct built-in `gpt-5.5` is not currently Harness-Routed, and custom model IDs lose the richer OpenAI-family harness.
