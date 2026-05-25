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

- `gpt-5.4`
- `gpt-5.5`
- one Claude Opus built-in model ID from Cursor's model picker
- one Claude Sonnet built-in model ID from Cursor's model picker
- one custom model ID returned by `/v1/models`, such as `codex-gpt-5.5-capture`

For each capture, record:

- Whether the request reached this server
- Which path Cursor used
- Which model ID Cursor sent in the body
- Whether the request was Chat Completions-like or Responses-like
- Differences in system/developer messages, tools, reasoning fields, and metadata

## Endpoints

- `GET /health` returns server status.
- `GET /v1/models` returns capture model IDs.
- `POST *` records the request and returns a minimal chat completion or chat completion SSE.
