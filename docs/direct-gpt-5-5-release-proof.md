# Direct GPT-5.5 Release Proof

Phase 3 recommends direct Cursor-facing `gpt-5.5` only while release evidence proves the request reaches the configured Extension Base URL route, keeps the expected OpenAI-family request shape, and preserves Cursor-selected reasoning fields.

## Sanitized Verifier Fixture

The committed sanitized proof fixture is:

```text
harness-capture/release-proof/direct-gpt-5.5-phase3.json
```

It records only routing-critical, non-secret fields:

- request path: `/v1/chat/completions`
- sanitized public-route host evidence: `Host` and `X-Forwarded-Host` are `phase3-proof.example.com`
- Cursor-facing model: `gpt-5.5`
- request shape: `responses`
- reasoning fields: `{ "effort": "low", "summary": "auto" }`

Verifier command:

```bash
python3 harness-capture/verify_capture.py harness-capture/release-proof/direct-gpt-5.5-phase3.json \
  --expect-model gpt-5.5 \
  --expect-shape responses \
  --expect-path-prefix /v1 \
  --expect-host phase3-proof.example.com \
  --expect-reasoning-effort low \
  --expect-reasoning-summary auto
```

Expected output:

```text
capture verified: model=gpt-5.5 shape=responses path=/v1/chat/completions host=phase3-proof.example.com reasoning_effort=low reasoning_summary=auto
```

## Packaged Runtime Proof

`pnpm run smoke` also starts the extension-staged API bundle, verifies `/v1/models` exposes `gpt-5.5` first, sends a direct `gpt-5.5` request to `/v1/chat/completions`, and asserts the outgoing Codex Responses request keeps upstream model `gpt-5.5` plus the selected reasoning fields. It also keeps explicit `gpt-5.4 -> gpt-5.5` fallback and disabled-fallback probes alive.

## Privacy Boundary

Do not commit raw live user captures. If a future live Harness Capture is needed, keep it under ignored `harness-capture/captures/`, verify it with `verify_capture.py`, and document only the sanitized filename, route host/path, model, shape, and reasoning fields.
