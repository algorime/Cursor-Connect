# Diagnostic Recording Mode

Status: accepted

V1 should include request/response recording only as an explicit diagnostic mode. It should be off by default, capture safe metadata by default when enabled, and require a separate raw-capture toggle for full bodies/tools using synthetic prompts only.

## Consequences

- Normal operation should not record user conversations or provider traffic.
- Normal logs should not contain raw request/response payloads; raw payload capture belongs only to explicit diagnostic recording mode.
- Safe diagnostic recording may capture timestamps, route, selected Cursor-Facing Model ID, resolved Upstream Model ID, request shape, status, latency, token usage, finish reason, and redacted headers.
- Raw body/tool capture should be a separate explicit mode for Harness Capture or support reproduction, with clear warnings to use synthetic prompts only.
- Authorization, cookies, API keys, OAuth tokens, and provider credentials must always be redacted and should never be written to recordings.
- Recordings should live in an extension-owned diagnostics directory with dashboard controls to open, clear, and export selected files.
- Diagnostic recording should support future Cursor routing verification and protocol regression debugging without turning V1 into a permanent traffic logger.
- Diagnostic recording is separate from local usage statistics: usage stats should not persist prompt bodies and should not send telemetry externally.
- Usage Statistics export options for raw identifiers are separate from diagnostic raw capture and should not enable raw body/tool recording.
- The doctor/check setup command should report whether diagnostic recording is enabled, but should not enable recording or export raw captures unless the user explicitly chooses that follow-up action.
