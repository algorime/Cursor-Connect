# Current Extension Host Runtime For Remotes

Status: accepted

For Remote SSH, dev container, WSL, and similar environments, V1 should use the current extension host's own runtime by default. The dashboard should not try to force every environment back to a local-machine API/tunnel.

## Consequences

- A local Cursor window uses the local extension-host runtime.
- A Remote SSH window uses that remote extension-host runtime.
- A dev container or WSL window uses the runtime available inside that extension-host boundary.
- Each environment may therefore have its own local API process, tunnel or user-owned public URL, generated local API key, auth state, and Usage Statistics store.
- Auth state should be separate by default, with explicit warning-gated sharing/import only when the user chooses it.
- Setup state and dashboard status should clearly identify which environment is being configured.
- Setup verification should prove the public Extension Base URL reaches the current extension-host runtime, not some other local/remote process, unless the user intentionally configures that advanced topology.
- Advanced user-owned public URLs can still point to a shared external endpoint if the user intentionally wants that, but V1 should not assume or bridge this automatically.
- Avoid brittle local-to-remote routing magic that hides where requests, auth, and usage data actually live.
- See also `0113-current-extension-host-public-url-boundary.md`.
