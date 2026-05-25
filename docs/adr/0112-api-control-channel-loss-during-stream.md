# API Control Channel Loss During Stream

Status: accepted

If the extension host exits, restarts, or loses its private control channel while the local API process is serving a Cursor stream, the API may finish only work that can be completed with request-scoped material it already received. It must become not-ready for new requests until the extension reconnects.

## Consequences

- An in-flight stream may continue if the API already has the request-scoped Codex access token and safe account context needed for that upstream attempt.
- The API must not refresh tokens, fetch new account state, change Active Codex Account, or perform new extension-authority operations without the extension control channel.
- New Cursor-facing requests should return a clear `service_not_ready` style OpenAI-compatible error while the control channel is disconnected.
- API readiness should fail while the private control channel is unavailable, even if `/health` still reports process liveness.
- Usage Statistics should record `extension_control_lost` if control-channel loss occurs during a request.
- Dashboard and doctor should distinguish `api_running_but_control_disconnected` from API process failure, Codex auth failure, public URL failure, and upstream Codex failure.
- When the extension reconnects, it re-establishes the internal control secret/channel, re-checks readiness, and resumes serving new requests only after authenticated internal control succeeds.
