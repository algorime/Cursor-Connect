# Durable Extension Base URL First

Status: accepted

V1 should optimize setup around a durable Extension Base URL. A user-owned permanent public URL, including a Cloudflare named-tunnel hostname, is preferred when available because Cursor's OpenAI Base URL cannot be reliably updated by the extension after setup.

Cloudflare Quick Tunnel remains useful for fast-start, testing, and users who accept that the URL may change. It should not be represented as equivalent to a durable URL.

## Consequences

- Setup should explain two public URL paths:
  - Durable URL: user provides a stable HTTPS URL that forwards to the extension local API.
  - Temporary Quick Tunnel: extension starts Cloudflare Quick Tunnel and gives the user a random URL that may change after restart.
- A user-provided URL becomes the canonical Extension Base URL only after two-stage verification: unauthenticated `/health` and authenticated `/ready` with the generated local API key.
- The user-provided URL can be backed by Cloudflare named tunnel, Caddy/Nginx reverse proxy, Tailscale Funnel, ngrok reserved domain, or any equivalent public HTTPS forwarding path.
- User-provided URL setup should show the stable local API target that the user's tunnel or reverse proxy must forward to.
- The extension should not require the local API to bind publicly; durable URL paths should forward to loopback where possible.
- Quick Tunnel URL changes should surface as setup repair/status events, not silent breakage.
- Cursor setup instructions should clearly tell the user which URL is canonical right now and whether it is durable or temporary.
- V1 should accept and verify existing durable URLs, but should not create/manage Cloudflare named tunnels itself unless a later decision adds account-backed Cloudflare automation.
