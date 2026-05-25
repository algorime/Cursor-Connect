# Protocol Fixture Suite Before Real Upstream

Status: accepted

Phase 2 should include a protocol fixture suite before relying on real Codex accounts as the first integration test. The extension already has captured Cursor request shapes and source-proxy evidence; those should become executable fixtures that lock down request adaptation and stream supervision before live upstream traffic.

The fixture suite should use captured built-in OpenAI-family Cursor requests, especially `gpt-5.4` and `gpt-5.4-mini`, plus representative Codex Responses SSE events for successful text, tool calls, reasoning, usage, `response.failed`, `response.incomplete`, transient rate limits, auth errors, and hard quota.

## Consequences

- Phase 2 should not start by manually testing against real Codex only; fixtures must define expected behavior first.
- Request fixtures should cover Responses-shaped bodies arriving on `/v1/chat/completions`, Cursor metadata/session identity, reasoning controls, `include`, `prompt_cache_retention`, tool schemas, and the Harness Routing Workaround.
- Stream fixtures should cover text deltas, tool-call deltas, reasoning deltas with default hidden reasoning display, usage extraction, finish chunks, and `[DONE]` behavior.
- Failure fixtures should cover `response.failed`, `response.incomplete`, stream close before completion, `insufficient_quota`, `rate_limit_exceeded`, `context_length_exceeded`, `401`, `402`, `429`, and `5xx` classification.
- Output-start detection should be fixture-tested so pre-output retry/switch decisions are safe and no mid-stream replay occurs after assistant-visible content, reasoning display, or tool-call deltas reach Cursor.
- The fixture suite should distinguish protocol correctness from private live Codex surface availability; live OAuth/quota/upstream tests can be layered after fixture behavior passes.
- Captures used as fixtures must remain synthetic/redacted and should not include production prompts, secrets, OAuth tokens, local API keys, or raw private account identity.
