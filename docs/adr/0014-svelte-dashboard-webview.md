# Svelte Dashboard Webview

Status: accepted

V1 should build the extension dashboard as a Svelte webview in `apps/web`, using the Ungate dashboard architecture as a practical reference while keeping the UI implementation clean and product-specific.

## Consequences

- `apps/web` owns dashboard UI, Codex setup flows, auth status, rich multi-account usage statistics, tunnel/API status, logs, notification preferences, and user-facing settings.
- Support export UI should make logs separately selectable rather than bundling them by default.
- Dashboard log controls should be separate from Usage Statistics controls and should include clear/export behavior for the bounded log store.
- The dashboard should provide detailed configuration for the compact status bar display, including whether it shows runtime state only, runtime plus limits, or is hidden.
- The dashboard should use a state-aware home screen: checklist-based setup before completion, Codex status and usage after completion, and any blocking failure promoted above normal views.
- First-run setup should include notification preferences, and dashboard settings should allow users to adjust notification categories later.
- Svelte is a good fit for the small reactive dashboard state needed by this extension without pushing UI state into the extension host.
- The extension should host the built web assets in a VS Code/Cursor webview and communicate with it through typed messages and local API calls.
- V1 should not add a dedicated sidebar view; the dashboard webview remains the rich UI surface.
- Command-palette actions should complement the dashboard for common setup/recovery actions such as copying setup values, restarting API/tunnel, refreshing limits, switching account, and opening logs.
- The dashboard should expose the doctor/check setup report and use the same pass/warn/fail health checks where useful.
- The dashboard should request the doctor report from extension-owned actions rather than a public local API `/doctor` endpoint.
- The dashboard should not directly access secrets; it should request auth/setup actions through the extension or local API boundary.
- Ungate is a useful reference for webview packaging, runtime state display, auth panels, and local analytics UI, but V1 should avoid copying provider complexity that is outside Codex auth-first scope.
