# Current Extension Host Public URL Boundary

Status: accepted

V1 should support remote extension-host environments only when the configured public Extension Base URL forwards to the local API running in that same extension-host environment. The extension should not try to bridge local Cursor UI requests into a remote SSH, WSL, or container API automatically.

## Consequences

- A local Cursor window uses the local extension-host API, local generated API key, local auth state, local Usage Statistics, and local public URL setup.
- A Remote SSH, WSL, or devcontainer window uses that extension-host boundary's API, generated API key, auth state, Usage Statistics, and public URL setup.
- Dashboard and doctor must show which environment owns the current runtime and which local loopback target the public URL must forward to.
- Setup verification must prove the public Extension Base URL reaches the current extension-host runtime via unauthenticated `/health` and authenticated `/ready`.
- No automatic local-to-remote port bridging, tunnel bridging, or hidden forwarding magic in V1.
- A user-owned URL may intentionally point elsewhere, but V1 should treat setup as ready only when health/readiness checks prove it reaches the current runtime expected by the user.
- This preserves clear ownership of requests, auth tokens, Usage Statistics, logs, and runtime failures across local and remote environments.
