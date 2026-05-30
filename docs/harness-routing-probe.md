# Harness Routing Probe

## Purpose

Before committing to the model ID strategy, test how Cursor routes built-in and custom model selections when a custom OpenAI Base URL is enabled.

In V1, the same idea should exist as a developer/diagnostic Harness Capture mode. Normal users should use the shipped supported model list, while maintainers and advanced users can run verification when Cursor updates or when model routing behavior is uncertain.

The local probe implementation lives in `harness-capture/`.

The temporary public `/harness/*` reverse-proxy route was removed after the captures were collected. The saved capture files remain available locally under `harness-capture/captures/`.

The probe must answer two questions for each selected model:

- Does the request reach the Extension Base URL?
- What exact request shape does Cursor emit for that model family?

## Current Hypotheses

- OpenAI-family built-in model IDs are expected to route through the custom OpenAI Base URL, but previous project notes say at least `gpt-5.5` may fail or bypass in some cases.
- Non-OpenAI built-in model IDs such as Claude models are unknown; if they reach the Extension Base URL, they may let the extension preserve Cursor's Claude-specific harness while routing to another provider.
- Custom model IDs probably reach the Extension Base URL but may receive a generic Cursor harness.

## Capture Requirements

Capture enough detail to compare Cursor behavior by model family:

- HTTP method, path, and query string
- Headers with credentials and authorization values redacted
- Full JSON body for controlled synthetic prompts
- Selected Cursor-Facing Model ID
- Request shape: Chat Completions-like or Responses-like
- System, developer, user, assistant, and tool message structure
- Tool schemas and tool choice
- Reasoning, verbosity, and model-control fields
- Metadata and session identity fields
- Whether the request reached the capture endpoint at all
- Minimal response behavior required to keep Cursor Agent usable during tests

## Safety Rules

- Use only synthetic prompts in a throwaway workspace.
- Redact authorization, API keys, cookies, and provider credentials.
- Do not capture real user secrets or production conversations.
- Prefer controlled raw body capture over content redaction; redacting prompt/tool content would destroy the evidence the probe exists to collect.
- In V1, normal diagnostic recording should be metadata-only by default; full raw body/tool capture should require a separate explicit toggle for synthetic prompts.

## Local Capture Server

Run:

```bash
python3 harness-capture/server.py --host 0.0.0.0 --port 5057
```

Use localhost only for local health checks:

```text
http://127.0.0.1:5057/v1
```

Cursor's backend cannot reach localhost. For Cursor, use the machine's public domain or reverse-proxy URL plus `/v1`, and ensure it routes to the local capture server port.

Smoke test completed successfully on port `5058`: `/health`, `/v1/models`, and a streaming `/v1/chat/completions` request all worked, and the generated capture preserved request body content while redacting the authorization header.

## Initial Test Matrix

| Cursor-selected model | Reaches Extension Base URL? | Request shape captured? | Notes |
| --- | --- | --- | --- |
| `gpt-5.4` built-in | Yes | Responses-shaped | Captured as `20260524-180636-cf145060.json`. User clarified the prompt text said `model=5.5`, but the selected Cursor model was actually `gpt-5.4`. |
| `gpt-5.4-mini` built-in | Yes | Responses-shaped | Captured as `20260524-180723-3f16d29e.json`. |
| `gpt-5.5` built-in | Verified for Phase 3 release contract | Responses-shaped proof fixture plus packaged smoke | Historical May 24 live capture did not reach the server, but ADR-0122 supersedes that posture. Phase 3 carries sanitized verifier evidence in `harness-capture/release-proof/direct-gpt-5.5-phase3.json` and packaged runtime smoke coverage. |
| `gpt-5-codex` built-in | Not pursued | None | Considered too old to matter for this product direction. |
| Claude Opus 4.7 built-in | No | None | User saw a normal answer but no capture file, so it likely routed to Cursor's own backend/provider path. |
| `codex-gpt-5.5-capture` custom alias | No | None | Routed to Cursor backend and errored before reaching the harness. |
| `claude-opus-4.7-capture` custom alias | No | None | Rejected by Cursor as an invalid model before reaching the harness. |
| `custom` | Yes | Chat Completions-shaped | Captured as `20260524-181130-50655fd6.json`; generic custom harness, not model-specific OpenAI Responses harness. |

## Observed Findings

- Built-in `gpt-5.4` and `gpt-5.4-mini` are Harness-Routed Models: they reach the Extension Base URL and preserve Cursor's OpenAI-family agent harness.
- Actual built-in `gpt-5.5` was not a Harness-Routed Model in the historical May 24 environment; it did not reach the capture server then.
- ADR-0122 records the current Phase 3 posture: direct `gpt-5.5` is the normal recommendation while release proof or equivalent verifier evidence confirms it reaches the Extension Base URL with the expected shape. The current non-secret proof artifact is documented in `docs/direct-gpt-5-5-release-proof.md`.
- The existing `gpt-5.4` to upstream `gpt-5.5` workaround remains an explicit advanced fallback, not the normal setup recommendation.
- Built-in Claude Opus 4.7 is not Harness-Routed here; it appears to bypass the Extension Base URL and route through Cursor's normal model backend.
- Arbitrary provider-looking custom aliases are not reliable in Cursor: `codex-gpt-5.5-capture` and `claude-opus-4.7-capture` did not produce captures.
- Literal `custom` does route through the Extension Base URL, but the body is generic Chat Completions-shaped rather than Cursor's richer OpenAI Responses-shaped harness.
- Because `custom` loses the richer harness, V1 setup should not expose it as a user-facing fallback; use Cursor's built-in OpenAI model list instead.
- V1 should not expose a general manual model-routing UI for this. If direct `gpt-5.5` regresses again, the known fallback is the small explicit Harness Routing Workaround that routes `gpt-5.4` to upstream `gpt-5.5`.
- `custom` should not become the fallback if model routing changes; the evidence-based fallback is to re-run Harness Capture and keep only verified built-in OpenAI-family model paths user-facing.
- If Cursor changes routing or request shape, diagnostic Harness Capture should produce evidence for a future extension update or explicit repair step; V1 should not silently patch unknown model-routing changes with downloaded rules.

## Captured Shape Differences

- `gpt-5.4` and `gpt-5.4-mini` requests used `input` rather than `messages`, so the capture server classified them as Responses-shaped even though they arrived on `/v1/chat/completions`.
- The OpenAI built-in captures included large Cursor agent system content, tool schemas, `store: false`, `include: ["reasoning.encrypted_content"]`, `prompt_cache_retention: "24h"` for `gpt-5.4`, `metadata.cursorConversationId`, `reasoning: {"effort": "medium", "summary": "auto"}`, and `stream_options.include_usage: true`.
- The `custom` capture used classic Chat Completions fields: `model`, `messages`, `stream`, `tools`, `user`, and `stream_options.include_usage`.
- This confirms that reaching the Extension Base URL is not enough; the Cursor-Facing Model ID determines whether Cursor sends the richer model-family harness or the generic custom-model harness.

## Context7 Notes

Current VS Code Extension API docs confirm the extension design can use standard activation, command registration, status bar items, webview panels, webview message handling, extension context subscriptions, and extension/webview state APIs. These docs support the planned extension shell and dashboard assumptions, but the probe itself still needs empirical Cursor traffic capture because Cursor routing behavior is product-specific.
