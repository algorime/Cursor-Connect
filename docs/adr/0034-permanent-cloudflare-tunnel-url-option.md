# Durable User-Owned Public URL

Status: accepted

V1 should let users provide a durable public URL, including a URL backed by their own Cloudflare named tunnel, and should treat this as the preferred stable setup path.

Cloudflare documentation distinguishes Quick Tunnels as anonymous temporary tunnels with random `*.trycloudflare.com` URLs that can change when the tunnel restarts, while named tunnels are account-backed and can be run by name/configuration with a user-owned hostname. Because Cursor Base URL setup cannot be reliably automated, durable URLs are better for the main setup path.

## Consequences

- Normal setup should recommend a durable public URL when the user can provide one.
- Setup should allow a user-owned public URL, including a permanent Cloudflare named-tunnel hostname.
- The dashboard should health-check the user-owned URL before treating it as the canonical Extension Base URL.
- The extension does not need to create or manage Cloudflare named tunnels in V1; it only needs to accept and verify the public URL if the user already has one.
- If the user-owned URL fails health/readiness checks, setup should show actionable errors and should not silently fall back without making the active Extension Base URL clear.
- Cloudflare Quick Tunnel remains available for temporary/fast-start use, with explicit warning that the URL may need to be pasted into Cursor again after restart.
