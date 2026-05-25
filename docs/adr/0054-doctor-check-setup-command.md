# Doctor Check Setup Command

Status: accepted

V1 should include a read-only doctor/check setup command that inspects the extension runtime and produces a clear pass/warn/fail report. The command should help users and support diagnose setup problems without enabling raw diagnostic recording or exposing secrets.

## Consequences

- The doctor command should be available from the command palette and dashboard.
- The full doctor report should be owned by the extension host, not a public local API `/doctor` endpoint.
- Checks should cover Codex auth/account state, token refresh readiness, local API health, tunnel or user-owned public URL health, generated local API key presence, Cursor setup confirmation, recommended model/workaround state, quota lookup status, status bar configuration, notification configuration, and diagnostic recording state.
- Checks should report compatibility statuses such as model routing changed, OAuth unavailable, quota unavailable, Cursor setup repair needed, OpenAI-key repair unavailable, or protocol shape changed when those can be detected safely.
- Checks should report the local API bind host and warn if it is broader than loopback.
- Checks may recommend local API key rotation for suspicious exposure, but should not rotate it automatically.
- Results should be grouped as pass, warning, or failure with actionable next steps.
- The report should be copyable/exportable for support, but must redact secrets, OAuth tokens, local API keys, raw prompts, raw provider responses, and sensitive account identifiers by default.
- Doctor/support exports should use redacted JSON as the canonical format, with optional Markdown summaries generated from the same redacted data.
- Doctor/support exports should include structured doctor data and Usage Statistics summaries by default; extension/API logs should be optional and separately selected.
- If logs are included, they should be redacted and limited to a recent time/window rather than exporting full historical logs by default.
- Doctor should report whether extension/API logs are within their bounded retention policy and keep log handling separate from Usage Statistics retention.
- The report may include local Codex Account Labels by default to make multi-account state understandable, but should still redact raw email/account IDs unless the user explicitly chooses an advanced export option.
- The command should not mutate state, restart processes, refresh tokens, alter Cursor settings, or enable recordings unless the user explicitly chooses a follow-up action.
- The doctor report should identify the current extension-host environment, especially for Remote SSH, WSL, and dev container contexts.
- If diagnostic recording is enabled, the doctor report should mention that state and point users to recording controls.
- The setup checklist may reuse the same health checks for verified status, but the doctor command should remain available after setup for recovery and support.
- The doctor may consume narrow local API health/status endpoints, but should aggregate and redact the final report in the extension host.
- Doctor checks that need readiness, model, or internal status details should use authenticated/internal API access rather than unauthenticated public health responses.
- Doctor checks should report unauthenticated route health and authenticated readiness as separate stages.
- Doctor should prefer explicit repair guidance and extension-update recommendations over silent compatibility patching.
