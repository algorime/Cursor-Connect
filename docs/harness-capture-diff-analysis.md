# Harness Capture Diff Analysis

## Compared Captures

| Label | Capture file | Cursor-Facing Model ID | Shape |
| --- | --- | --- | --- |
| GPT 5.4 built-in | `harness-capture/captures/20260524-180636-cf145060.json` | `gpt-5.4` | Responses-shaped body on `/v1/chat/completions` |
| GPT 5.4 Mini built-in | `harness-capture/captures/20260524-180723-3f16d29e.json` | `gpt-5.4-mini` | Responses-shaped body on `/v1/chat/completions` |
| Custom model | `harness-capture/captures/20260524-181130-50655fd6.json` | `custom` | Chat Completions-shaped body on `/v1/chat/completions` |

Temporary machine-generated diff artifacts were written to `/tmp/opencode/capture-diff/` during analysis.

## GPT 5.4 vs GPT 5.4 Mini

The captures are nearly identical. A recursive JSON-path diff found exactly six differing paths:

```text
$.input[0].content
$.input[2].content[1].text
$.metadata.cursorConversationId
$.model
$.prompt_cache_retention
$.tools[3].description
```

Meaningful differences:

- `model` changed from `gpt-5.4` to `gpt-5.4-mini`.
- The first system line changed from `You are GPT-5.4.` to `You are GPT-5.4 Mini.`.
- `gpt-5.4` included `prompt_cache_retention: "24h"`; `gpt-5.4-mini` did not include `prompt_cache_retention`.
- The user prompt/timestamp differed because the manual test message differed.
- `metadata.cursorConversationId` differed because these were separate conversations.
- One `AwaitShell` tool-description line differed:

```diff
-  - Size `block_until_ms` to the command's expected runtime. When waiting further, size slices based on expected progress. When progress is unclear, exponential backoff is useful.
+  - Size `block_until_ms` to the command's expected runtime. When waiting further, avoid round 5-minute waits: prefer slices of 60-270s (keeps prompt cache warm) or 1200s+ (one cache miss buys a long wait).
```

Non-differences:

- Same endpoint: `/v1/chat/completions`.
- Same `User-Agent`: `Cursor/1.0`.
- Same Responses-shaped top-level structure: `input`, `tools`, `include`, `metadata`, `reasoning`, `store`, `stream`, `stream_options`, `user`.
- Same `include: ["reasoning.encrypted_content"]`.
- Same `reasoning: {"effort": "medium", "summary": "auto"}`.
- Same `store: false`.
- Same `stream: true` and `stream_options.include_usage: true`.
- Same input role sequence: `system`, `user`, `user`.
- Same tool count: 17.
- Same tool names and parameter shapes.

Conclusion: `gpt-5.4` and `gpt-5.4-mini` use the same Cursor OpenAI-family agent harness, with only model label, cache-retention, conversation/test text, and one tool-instruction wording difference.

These captured bodies should become protocol fixtures before live Codex integration. They define the expected Cursor request shape for V1 request adaptation, model routing, session identity handling, reasoning controls, and tool schema preservation.

## GPT 5.4 Built-In vs Custom

A recursive JSON-path diff found 95 differing paths. The difference is architectural, not cosmetic.

Top-level body shape:

```diff
- include
- input
- metadata
- prompt_cache_retention
- reasoning
- store
+ messages
  model
  stream
  stream_options
  tools
  user
```

GPT 5.4 built-in used a Responses-shaped body even though it arrived at `/v1/chat/completions`:

```json
{
  "model": "gpt-5.4",
  "input": [...],
  "tools": [...],
  "store": false,
  "include": ["reasoning.encrypted_content"],
  "prompt_cache_retention": "24h",
  "metadata": {
    "cursorRequestId": "",
    "cursorConversationId": "..."
  },
  "reasoning": {
    "effort": "medium",
    "summary": "auto"
  },
  "stream_options": {
    "include_usage": true
  }
}
```

Custom used a classic Chat Completions-shaped body:

```json
{
  "model": "custom",
  "messages": [...],
  "tools": [...],
  "stream": true,
  "stream_options": {
    "include_usage": true
  },
  "user": "..."
}
```

System prompt differences:

- Built-in `gpt-5.4` starts as `You are GPT-5.4.` and uses Cursor's OpenAI-family agent instructions.
- `custom` starts as `You are an AI coding assistant, powered by custom.` and uses a generic custom-model harness.
- The system prompt line diff was large: 405 unified-diff lines.

Tool differences:

- Built-in `gpt-5.4` sent 17 tools using flat Responses-style tool definitions.
- `custom` sent 18 tools using nested Chat Completions `function` definitions.
- Built-in tool names included `rg`, `ReadFile`, `ApplyPatch`, and `Subagent`.
- Custom tool names included `Grep`, `Read`, `StrReplace`, `Write`, and `Task`.
- Built-in included `ApplyPatch` as a `custom` tool with a grammar format; custom did not.
- Custom had `Write`; built-in did not.

Conclusion: `custom` reaches the Extension Base URL, but it does not preserve the same Cursor harness as built-in OpenAI-family model IDs. Using `custom` would lose the richer Responses-shaped request, native reasoning controls, prompt cache retention, Cursor conversation metadata, and the OpenAI-family tool schema shape.

## Product Implication

For the original V1 probe, the safest path was a Harness-Routed OpenAI built-in Cursor-Facing Model ID such as `gpt-5.4`. ADR-0122 supersedes that recommendation for the current Phase 3 release posture: while fresh release proof or equivalent verifier evidence confirms direct routing, prefer direct Cursor-facing `gpt-5.5`; keep the `gpt-5.4` to upstream `gpt-5.5` Harness Routing Workaround as a small opt-in fallback only.

The workaround was previously recommended despite imperfect 1:1 harness labeling. Built-in `gpt-5.4` starts with `You are GPT-5.4.`, so upstream `gpt-5.5` may receive same-family GPT-5.4-shaped harness text. Under ADR-0122, that tradeoff is no longer the normal first-run setup path while direct `gpt-5.5` is verified.

Do not treat arbitrary custom model IDs as equivalent to built-in model IDs. They are useful for diagnostics because they prove the Extension Base URL can be reached, but they should not be a user-facing fallback because they produce a materially different and weaker harness. Also do not expose Azure-era general rewrite-table complexity for V1.

This is also why V1 should avoid non-Codex provider surfaces. The `custom` capture proves that simply reaching the Extension Base URL can be lower quality than using a Harness-Routed Model, so enabling future integrations without a proven Cursor-Facing Model ID strategy would likely produce worse UX/performance.

V1 should not expose `custom` as a user-facing fallback. Setup should use Cursor's built-in OpenAI model list and the currently verified direct OpenAI-family model path, with Harness-Routed fallback behavior retained only as an explicit compatibility escape hatch.
