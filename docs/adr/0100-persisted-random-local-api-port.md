# Persisted Random Local API Port

Status: accepted

V1 should choose a random available high port for the local API on first setup for each extension-host runtime, persist that port, and keep using it across restarts. This avoids common fixed-port collisions while keeping the local forwarding target stable for user-owned public URLs.

The extension should not silently move the local API to a different port after setup because that would break Cloudflare named tunnels, reverse proxies, or other user-owned URL forwarding configuration.

## Consequences

- First setup picks an available high port and stores it in non-secret extension state for the current extension-host runtime.
- The dashboard shows the stable local target URL, such as `http://127.0.0.1:<persisted-port>`, for the user's forwarding infrastructure.
- The API binds to `127.0.0.1:<persisted-port>` by default.
- If the persisted port is unavailable later, setup/doctor reports a repair-required state instead of silently changing the local target.
- The first tracer bullet should prove persisted-port reuse after restart and repair-required behavior when that port is unavailable.
- Repair UI may offer to stop a stale owned process, retry the same port, or explicitly choose a new port.
- Choosing a new port is an explicit repair action and must warn that user-owned public URL forwarding must be updated.
- Cloudflare Quick Tunnel can follow the active local port automatically because the extension owns that temporary tunnel lifecycle.
- User-owned public URLs require stable local port behavior because the extension does not own the external tunnel/reverse-proxy configuration.
- Remote SSH, WSL, dev container, and other extension-host environments each have their own persisted local API port.
