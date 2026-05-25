# Loopback Local API, Public Through Tunnel

Status: accepted

V1 should bind the local API to `127.0.0.1` by default. Public reachability should come through the managed tunnel or a health-checked user-owned public URL, not by exposing the local API directly on the LAN or all interfaces.

## Consequences

- The local API should listen on loopback by default.
- The local API should use a persisted random high port per extension-host so user-owned public URL forwarding can survive extension restarts while avoiding common fixed-port collisions.
- If the persisted port is unavailable, setup/doctor should report repair required instead of silently changing the local target.
- The managed Cloudflare Quick Tunnel should target the loopback local API.
- User-owned public URLs should point to a route that reaches the loopback local API through user-managed infrastructure.
- The dashboard should show the local loopback target URL separately from the public Extension Base URL.
- The generated local API key remains required for Cursor-facing OpenAI-compatible requests regardless of tunnel type.
- Advanced bind-host override may exist for unusual environments, but should be warning-gated and not part of normal setup.
- The setup checklist and doctor command should report the bind host and warn if it is broader than loopback.
- Broader-than-loopback binding should prompt the user to review exposure and may recommend regenerating the local API key if exposure was unintended.
- Binding to `0.0.0.0` or a LAN address should never be silently enabled by default.
