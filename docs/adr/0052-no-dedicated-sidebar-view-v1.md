# No Dedicated Sidebar View In V1

Status: accepted

V1 should not add a dedicated Cursor/VS Code sidebar view. The main UI surfaces are the dashboard webview, the compact status bar item, and configurable notifications.

## Consequences

- The dashboard webview owns rich setup, auth, account management, Usage Statistics, logs, and settings.
- The status bar owns ambient runtime/limit state and opens the dashboard when clicked.
- Notifications handle actionable or surprising events according to user preferences.
- Avoiding a sidebar keeps V1 UI scope smaller and avoids designing/maintaining another navigation surface.
- If a future sidebar becomes useful, it should require a separate decision with a clear job distinct from dashboard/status/notifications.
