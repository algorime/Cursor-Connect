# Dashboard Dangerous Setup Actions

Status: accepted

Dangerous setup repair actions should use explicit in-dashboard confirmation rather than browser-native confirmation dialogs or one-click execution. Local API key rotation is the Phase 3 example because it intentionally invalidates Cursor's current API key and requires user repair.

## Consequences

- Local API key rotation should be presented as an advanced repair action, not a primary first-run setup action.
- The dashboard should require a two-step in-dashboard confirmation before rotating the local API key.
- Rotation confirmation copy should explain that the old Cursor API key will stop working, Cursor settings must be updated, the public route should be reverified, and Codex OAuth tokens are not affected.
- Phase 3 does not require typed-phrase confirmation for key rotation; a clear two-step confirm row/button is enough.
- Browser-native `window.confirm` should not be the polished dashboard pattern for setup-changing actions.
