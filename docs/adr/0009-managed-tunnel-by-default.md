# Durable Public URL Preferred

Status: accepted

The extension should support public reachability through a durable Extension Base URL. Because Cursor's Base URL cannot be reliably updated by the extension, the V1 happy path should prefer a permanent user-owned public URL, including a Cloudflare named-tunnel hostname, over an ephemeral Cloudflare Quick Tunnel URL.

Cloudflare Quick Tunnel remains useful as a fast-start or temporary setup path, but it should not be presented as the durable default because its random public URL can change when the tunnel restarts.

## Consequences

- Users should get one canonical Extension Base URL that remains stable after restarts whenever possible.
- The setup checklist should recommend a durable URL path first: user-owned Cloudflare named tunnel or another user-provided public URL that forwards to the local API.
- Cloudflare Quick Tunnel may be offered as a temporary/fast-start option with clear wording that the URL can change and may require re-pasting in Cursor.
- The managed tunnel should expose the loopback local API; the local API itself should not bind publicly by default.
- V1 should not expose multiple managed tunnel provider choices; the built-in temporary managed path is Cloudflare Quick Tunnel.
- V1 should provision `cloudflared` automatically so normal users do not need a separate tunnel installation step.
- The dashboard should expose one canonical Extension Base URL regardless of whether it comes from the managed tunnel or a user-owned public URL.
- User-owned public URLs should be first-class in setup, not buried as an expert-only escape hatch, because they are the durable path.
- A user-owned public URL should be treated as the Extension Base URL only after it passes the same two-stage health/readiness checks as the managed tunnel URL: unauthenticated `/health` for route liveness and authenticated `/ready` for usable setup.
- User-owned public URLs should be an intentional public exposure path; they should not require the extension to bind the local API to all interfaces by default.
- A user-owned public URL may be backed by the user's own permanent Cloudflare named tunnel; V1 does not need to create/manage named tunnels itself.
- The implementation should isolate tunnel management from Codex protocol logic so networking remains a reusable infrastructure boundary without forcing provider abstractions into V1.
