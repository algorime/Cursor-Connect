# Internal Control Secret Over Loopback

Status: accepted

V1 should implement the extension-to-API private control channel with an extension-generated internal control secret passed to the API process when it is spawned. Internal loopback endpoints used for extension-owned control calls should require that secret and remain distinct from Cursor-facing OpenAI-compatible endpoints guarded by the generated local API key.

This is the first implementation choice because it is simpler to build, test, and supervise than custom IPC while preserving the key boundary: Cursor's local API key must not grant extension-authority control, and the API must not read or persist long-lived Codex secrets.

## Consequences

- The extension generates a high-entropy internal control secret for the shared runtime and passes it to the API process through spawn-time process state such as environment variables or an equivalent private launch mechanism.
- The internal control secret is separate from the generated local API key that Cursor uses against the Extension Base URL.
- Internal control endpoints should bind only on loopback and should reject requests missing the internal control secret.
- The internal control secret should not be shown in the dashboard, copied to Cursor, exported in support bundles, logged, stored in Usage Statistics, or synced.
- API readiness should require that the internal control channel is configured and that extension-owned calls can authenticate.
- The first tracer bullet should prove the generated local API key cannot authenticate internal control endpoints and the internal control secret cannot be treated as the Cursor-facing API key.
- The extension may use this channel for auth handoff, safe internal status, usage queries/exports, and supervised repair actions that are not part of the public OpenAI-compatible surface.
- The API should still treat request-scoped Codex access tokens received over this channel as temporary in-memory material only.
- If the API process restarts, the extension should establish a fresh internal control secret or re-send the runtime secret during spawn, then re-check readiness.
- If the internal control channel disconnects while the API process remains alive, `/health` may still report liveness but authenticated readiness should fail until the extension re-establishes control.
- If loopback HTTP control proves unsafe or unreliable in packaging tests, a later decision may replace it with custom IPC while preserving the same authority boundary.
