# Shared Runtime Per Extension Host

Status: accepted

V1 should share as much runtime state as possible across Cursor windows instead of starting one local API and tunnel per window. The sharing boundary is the extension host/user profile that can safely share local files, locks, SecretStorage access, ports, and process ownership.

## Consequences

- Multiple local Cursor windows for the same user/profile should share one local API process, one persisted local API target/port, one tunnel or user-owned Extension Base URL, one generated local API key, one Codex auth state, and one Usage Statistics store.
- The extension should use leader election/runtime-state coordination so one window owns API/tunnel lifecycle and another can take over if the leader closes.
- If all windows in a shared runtime close, the API/tunnel may stop after a short grace period.
- Remote SSH, dev container, WSL, or similar environments may have separate extension hosts and filesystem/network boundaries; each environment should use the current extension host's runtime by default and share only within its own boundary rather than trying to force one unsafe global process across all environments.
- The dashboard should make the active runtime location/status clear enough that users understand whether they are configuring a local or remote environment.
- Token refresh, generated local API key handling, tunnel lifecycle, and Usage Statistics writes should coordinate through the shared runtime state to avoid races and duplicates.
