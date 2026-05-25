# Checklist First-Run Setup

Status: accepted

First-run setup should be a checklist, not a strict wizard. Some Cursor setup steps cannot be fully automated or reliably detected, so V1 must let users retry, skip, or manually confirm steps without trapping them in a linear flow.

## Consequences

- The setup checklist should show required steps such as Codex sign-in, local API readiness, public URL readiness, generated local API key copy, Cursor Base URL/API key setup, OpenAI-key repair state, recommended model/workaround selection, status bar limit display preference, and notification preference selection.
- OpenAI-key repair should be presented as a recommended first-run choice, not silently enabled, because it relies on private Cursor behavior.
- Public URL setup should prefer a durable user-owned URL, including a permanent Cloudflare named-tunnel hostname when available; Cloudflare Quick Tunnel should be labeled temporary/fast-start because its URL may change and require Cursor settings repair.
- When the user adds a second Codex Account, account setup should recommend hard-limits-only automatic switching but require an explicit choice before enabling it.
- The normal setup checklist should not include cross-environment auth transfer; that belongs under Advanced auth controls.
- Each step should expose the best available action: automate when stable, copy values, open settings, retry detection, or mark manually completed.
- Essential incomplete steps should stay visible with strong warnings rather than blocking access to the rest of the dashboard.
- Manual confirmation should be clearly labeled as user-confirmed, not automatically verified.
- Notification setup should explain available categories and that extension notifications never inject content into Cursor chat.
- The checklist should be resumable after reload/restart and should derive verified status from runtime checks when possible.
- The setup checklist should share health-check logic with a read-only doctor/check setup command so setup verification and later diagnostics stay consistent.
- The checklist should distinguish public route health from authenticated readiness so a reachable tunnel is not confused with complete Cursor setup.
- In Remote SSH, dev container, WSL, or similar contexts, the checklist should describe and validate the current extension-host runtime rather than silently mixing it with a local-machine runtime.
