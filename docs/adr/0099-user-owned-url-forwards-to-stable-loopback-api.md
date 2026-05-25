# User-Owned URL Forwards To Stable Loopback API

Status: accepted

A user-owned public URL reaches the extension backend by forwarding HTTPS requests to the extension's local API process running on loopback. V1 should make this concrete in setup by exposing a stable local target URL, such as `http://127.0.0.1:<port>`, that the user's Cloudflare named tunnel, reverse proxy, or equivalent public forwarding service points to.

The extension does not make DNS or Cloudflare routing happen by itself in V1. It accepts a public URL, shows the local forwarding target, provides copyable example configuration, and verifies that the public URL actually reaches this extension runtime.

## Consequences

- The local API should use a persisted random high port per extension-host so user-owned tunnel/reverse-proxy configuration does not break after restart.
- If the persisted port is unavailable, setup must surface a repair-required state rather than silently changing the local target.
- Choosing a new local port should be an explicit repair action that warns the user-owned URL forwarding configuration must be updated.
- For a Cloudflare named tunnel, the user runs/configures `cloudflared` so their hostname forwards to `http://127.0.0.1:<extension-api-port>` on the same extension-host environment.
- For Caddy, Nginx, ngrok reserved domains, Tailscale Funnel, or similar options, the user's public HTTPS endpoint must forward to the same local API target.
- The extension verifies public URL routing with two checks: unauthenticated `/health` for route liveness and authenticated `/ready` with the generated local API key for proof that the route reaches this extension backend.
- Verification should show the active runtime environment because local, Remote SSH, WSL, and dev container hosts may each have different loopback addresses and ports.
- The local API should still bind to loopback by default; user-owned URLs should reach it through a tunnel or local reverse proxy rather than requiring `0.0.0.0` binding.
- The dashboard should show both values distinctly: local target URL for forwarding infrastructure and public Extension Base URL for Cursor.
- V1 should accept and verify existing durable URLs, but should not create/manage Cloudflare named tunnels or Cloudflare account configuration unless a later decision adds that complexity.
