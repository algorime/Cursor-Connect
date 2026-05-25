# Command Palette Recovery Actions

Status: accepted

V1 should expose common setup, inspection, and recovery actions through the Cursor/VS Code command palette. This gives power users and support flows direct access without adding another permanent UI surface.

## Consequences

- Provide a command to open the dashboard.
- Provide copy commands for the Extension Base URL and generated local API key.
- Provide recovery commands to restart the local API and restart the tunnel.
- Provide a command to refresh Codex limits/quota status.
- Provide a command to switch the Active Codex Account.
- Provide a command to open logs.
- Provide a read-only doctor/check setup command that reports auth, API, tunnel, Cursor setup, quota, and configuration health.
- Commands should reuse the same underlying extension actions as dashboard buttons/status bar clicks rather than duplicating logic.
- Commands that expose or copy sensitive setup values must avoid logging secrets and should use clear labels/warnings where appropriate.
- Command availability should reflect runtime state where practical, but core recovery commands should remain discoverable even during failures.
