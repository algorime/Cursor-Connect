# Extension API Private Control Channel

Status: accepted

V1 should connect the extension host and the separate local API process through an extension-owned private control channel. The API process should request valid Codex access tokens and account context from the extension for the current request instead of reading `SecretStorage`, storing long-lived credentials, or refreshing OAuth tokens independently.

The public OpenAI-compatible HTTP surface and the private extension-to-API control surface are separate boundaries. Cursor-facing requests use the generated local API key; API-to-extension control messages use a private channel established by the extension when it spawns/supervises the API process.

## Consequences

- The extension host remains the authority for `SecretStorage`, token refresh, logout, account state, and multi-window refresh serialization.
- The API process owns request adaptation, upstream call orchestration, stream supervision, response adaptation, and Usage Statistics writes, but not long-lived secret storage.
- For each upstream Codex attempt, the API asks the extension for the selected Codex Account's current access token and safe account context.
- The extension may refresh before replying if the access token is expired or near expiry, using the per-account refresh lock already required by the token-refresh decision.
- The API should receive only request-scoped auth material: access token, account id/header values needed upstream, expiry, local Codex Account key/label/fingerprint as needed for Usage Statistics, and safe capability/quota state.
- The API must not persist access tokens, refresh tokens, ID tokens, imported Codex CLI token material, or generated local API keys in its SQLite database, logs, or state files.
- The control channel should have short timeouts. If the extension cannot provide auth promptly, the API returns a clear auth-not-ready/auth-timeout error rather than hanging Cursor indefinitely.
- API restart should re-establish the private control channel before readiness reports success.
- Extension host shutdown during an active stream is a failure mode: the API may finish only if it already has the request-scoped access token; it must not attempt future refreshes without the extension.
- If the control channel is lost, new requests should fail as not-ready until the extension reconnects, even if an already-authorized in-flight stream can finish.
- Multi-window leader election should ensure exactly one extension authority answers token/refresh control requests for the shared runtime.
- Control-channel failures should surface in doctor/status/dashboard as extension-to-API handoff failures, distinct from Codex auth failures and upstream provider failures.
- V1's initial concrete transport should be loopback internal endpoints protected by an extension-generated internal control secret passed when the API process is spawned.
- The internal control secret must remain separate from the generated local API key that Cursor uses; leaking the Cursor local API key must not grant extension-authority control.
- A later decision may replace loopback internal endpoints with custom IPC if packaging or security tests require it, while preserving the same authority boundary.
- See also `0112-api-control-channel-loss-during-stream.md`.
