# Always Auto-Start

Status: accepted

The extension should auto-start its local API server and public tunnel every time Cursor starts. The product goal is the easiest possible user experience: once installed and configured, users should not need to manually start the extension before using Cursor.

## Consequences

- The extension owns process lifecycle and should start the local API server during activation.
- The extension owns tunnel lifecycle and should start or recover the public tunnel during activation.
- Runtime startup should be shared across Cursor windows within the same extension-host/user-profile boundary rather than starting duplicate API/tunnel processes per window.
- The dashboard and always-visible status bar should show progress, errors, quota/limit state, and recovery actions, but they should not be required for normal startup.
- Startup must be resilient: missing auth, port conflicts, tunnel failures, or stale processes should produce actionable status instead of silent failure.
- Manual Start, Stop, and Restart controls remain useful for recovery, but not as the default path.
- Recovery commands such as restart local API and restart tunnel should be available from the command palette.
