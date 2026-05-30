# Harness Capture Server

This is a throwaway local server for Cursor harness-routing research. It records the exact synthetic request Cursor sends for a selected model and returns a minimal OpenAI-compatible response.

## Run

```bash
python3 harness-capture/server.py --host 0.0.0.0 --port 5057
```

Cursor's backend cannot reach localhost. Use this only for local health checks:

```text
http://127.0.0.1:5057/v1
```

For Cursor, use the machine's public domain or reverse-proxy URL plus `/v1`, for example:

```text
https://<public-domain>/v1
```

The public URL must route to the local capture server port.

## What It Captures

Each POST request creates a JSON file in `harness-capture/captures/` containing:

- HTTP method, path, and query
- Headers with credential-like values redacted
- Raw body text
- Parsed JSON body when valid JSON
- Cursor-Facing Model ID from `body.model`
- Request shape classification
- Whether `stream: true` was requested

The captures directory is gitignored because it may contain full synthetic prompt and tool schema content.

## Safety

- Use synthetic prompts only.
- Do not use real production conversations.
- Authorization, cookies, and common API-key headers are redacted.
- Body content is intentionally preserved because harness differences may live in prompts, tools, reasoning fields, and metadata.

## Suggested Manual Probe Matrix

For each model selected in Cursor Agent, send the same synthetic prompt and inspect whether a capture file appears.

Suggested prompt:

```text
Harness probe. Reply with exactly: PROBE_OK. Do not inspect files or run tools unless the harness requires it.
```

Start with:

- `gpt-5.5` (the normal direct Phase 3 path)
- `gpt-5.4` (advanced fallback/workaround path)
- one Claude Opus built-in model ID from Cursor's model picker
- one Claude Sonnet built-in model ID from Cursor's model picker
- one custom model ID returned by `/v1/models`, such as `codex-gpt-5.5-capture`

For each capture, record:

- Whether the request reached this server
- Which path Cursor used
- Which model ID Cursor sent in the body
- Whether the request was Chat Completions-like or Responses-like
- Differences in system/developer messages, tools, reasoning fields, and metadata

## Verify A Current Cursor Capture

Use this when checking that Cursor still emits the model ID and reasoning fields the extension depends on. Start the capture server, point Cursor's OpenAI-compatible Base URL at the public route ending in `/v1`, then send the synthetic probe above.

For a normal direct `gpt-5.5` Cursor capture:

```bash
python3 harness-capture/verify_capture.py harness-capture/captures/<capture>.json \
  --expect-model gpt-5.5 \
  --expect-shape responses \
  --expect-path-prefix /v1 \
  --expect-host <public-route-host> \
  --expect-reasoning-effort medium \
  --expect-reasoning-summary auto
```

The Phase 3 release keeps a sanitized direct-model proof fixture at
`harness-capture/release-proof/direct-gpt-5.5-phase3.json`. Verify it with:

```bash
python3 harness-capture/verify_capture.py harness-capture/release-proof/direct-gpt-5.5-phase3.json \
  --expect-model gpt-5.5 \
  --expect-shape responses \
  --expect-path-prefix /v1 \
  --expect-host phase3-proof.example.com \
  --expect-reasoning-effort low \
  --expect-reasoning-summary auto
```

For `gpt-5.4-mini`:

```bash
python3 harness-capture/verify_capture.py harness-capture/captures/<capture>.json \
  --expect-model gpt-5.4-mini \
  --expect-shape responses \
  --expect-path-prefix /v1 \
  --expect-host <public-route-host> \
  --expect-reasoning-effort medium \
  --expect-reasoning-summary auto
```

This validates what Cursor sent into the extension-facing route. To verify what the extension sends upstream after applying the workaround, run the packaged smoke test:

```bash
pnpm run build
pnpm run smoke
```

The smoke test captures the API bundle's outgoing Codex Responses POST and checks both `gpt-5.4 -> gpt-5.5` enabled and `gpt-5.4 -> gpt-5.4` disabled.

## Endpoints

- `GET /health` returns server status.
- `GET /v1/models` returns capture model IDs.
- `POST *` records the request and returns a minimal chat completion or chat completion SSE.
