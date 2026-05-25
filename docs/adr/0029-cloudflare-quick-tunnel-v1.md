# Cloudflare Quick Tunnel As Temporary V1 Path

Status: accepted

V1 may use Cloudflare Quick Tunnel as the single built-in temporary managed tunnel implementation. The product should not expose multiple managed tunnel provider choices in V1.

Quick Tunnel should not be the durable happy-path Extension Base URL because Cloudflare generates a random `trycloudflare.com` URL that can change when the tunnel restarts, and Cursor Base URL setup cannot be reliably automated.

## Consequences

- The Quick Tunnel path should follow the proven Ungate-style approach: start `cloudflared`, expose the local API, and surface the resulting public URL.
- V1 should provision `cloudflared` automatically through a packaged binary or extension-owned download path, rather than requiring manual installation.
- Tunnel provider choice should not appear in the normal setup UI.
- The implementation may keep a small internal tunnel abstraction for lifecycle, status, logs, and URL reporting, but only Cloudflare Quick Tunnel needs built-in lifecycle automation for V1.
- Users who want durable setup should provide a user-owned public URL.
- Users with their own permanent Cloudflare named tunnel may provide that public URL and use it as the canonical Extension Base URL.
- Quick Tunnel UI must clearly warn that URL changes can require updating Cursor settings.
- Any future tunnel provider should require a separate decision, concrete need, and equivalent health/readiness behavior.
