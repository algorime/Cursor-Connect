# Local API Endpoint Auth Boundary

Status: accepted

V1 should expose only `/health` without authentication. All endpoints that reveal readiness, setup details, model details, account-related state, or proxy functionality should require the generated local API key or an extension-private channel.

This keeps tunnel and process health checks simple while avoiding useful information disclosure through the public Extension Base URL.

## Consequences

- `/health` may be unauthenticated and should return only minimal process liveness such as `ok`.
- `/ready` should require authentication because readiness can reveal setup/auth/provider state.
- Tunnel liveness should use `/health`; setup readiness should use authenticated `/ready` with the generated local API key.
- `/v1/models` should require authentication because model availability and routing are extension setup details.
- `/v1/chat/completions` and any future OpenAI-compatible request endpoints must require authentication.
- Internal endpoints such as `/internal/status` must require the generated local API key or an extension-private control channel.
- The extension-private control channel should use a separate secret/transport from the generated local API key that Cursor uses; exposing the Cursor API key must not grant extension-authority control.
- V1 should initially implement extension-private control through loopback internal endpoints guarded by an extension-generated internal control secret passed to the API process at spawn time.
- Unauthenticated responses should avoid account identity, model lists, tunnel details, quota state, auth state, local paths, and runtime diagnostics.
- Failed authentication should return generic `401` or `403` responses without setup, account, model, quota, path, tunnel, or runtime details.
- Public-facing endpoints should enforce bounded body size, sane request/streaming timeouts, authentication-failure rate limiting, and structured safe logs.
- Doctor/check setup may use authenticated/internal signals, but public health checks should remain minimal.
- See also `0111-public-extension-base-url-threat-model.md`.
