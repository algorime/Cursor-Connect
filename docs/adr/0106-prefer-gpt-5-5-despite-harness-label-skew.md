# Prefer GPT-5.5 Despite Harness Label Skew

Status: superseded by ADR-0122

This ADR captured the older workaround-first posture: V1 recommended routing Cursor-Facing `gpt-5.4` to Upstream `gpt-5.5` as the best known model-quality path, even though Cursor's captured harness could still label or prompt the request as GPT-5.4.

ADR-0122 supersedes that posture for current Phase 3: while direct routing is verified, setup recommends direct Cursor-facing `gpt-5.5` and keeps the GPT-5.4-to-GPT-5.5 Harness Routing Workaround as an explicit advanced fallback only.

The mismatch is not ideal, but it remains acceptable as a fallback because `gpt-5.4` and `gpt-5.5` are same-family OpenAI/Codex models and the upstream `gpt-5.5` quality gain can be more important than exact 1:1 harness labeling. This tradeoff is relevant only if direct Cursor-Facing `gpt-5.5` regresses and fresh Harness Capture or equivalent release evidence proves the fallback is safer.

## Consequences

- The recommended setup no longer selects `gpt-5.4` first; it selects direct Cursor-facing `gpt-5.5` while that path is verified.
- Setup copy should be honest: Cursor may display and shape the request as `gpt-5.4`, while the extension sends it to Codex as `gpt-5.5`.
- The workaround should not be strongly recommended during first-run setup while ADR-0122's direct path holds.
- This is still a specific known workaround, not a general manual model-routing UI.
- If future evidence proves direct `gpt-5.5` no longer reaches the Extension Base URL with a good harness, V1 can reactivate the explicit `gpt-5.4` route workaround.
- The preferred posture is direct built-in `gpt-5.5` routing, not falling back to `custom`.
- Diagnostic docs should preserve both evidence eras: the historical May 24 capture set showed built-in `gpt-5.4` as Harness-Routed and direct built-in `gpt-5.5` as not captured, while the current Phase 3 release posture relies on ADR-0122 direct-model proof artifacts before recommending direct `gpt-5.5`.
