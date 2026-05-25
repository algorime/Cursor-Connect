# Configurable Extension Notifications, No Chat Injection

Status: accepted

V1 should never inject account-switch, quota, setup, tunnel, API, or other operational notices into Cursor chat responses. Cursor chat content should remain model output only so the extension does not pollute Cursor Agent context or influence tool/planning behavior.

Operational notices should instead use extension-owned surfaces: dashboard, status bar, logs, and configurable VS Code/Cursor notifications when useful.

## Consequences

- Account switch events should be visible through Usage Statistics, dashboard history, status bar state, and optional notifications, not assistant message content.
- Pre-stream account retries should stay invisible to Cursor chat unless all retries fail and a real error must be returned.
- Useful events can produce notifications, such as account switched, account limit reached, auth expired, tunnel URL changed, API stopped/recovered, setup incomplete, quota lookup stale, or diagnostic recording enabled.
- Notifications should be configurable by category and severity so users can reduce noise.
- Notification preferences should be offered during first-run setup so users know the notification categories exist and can choose their desired noise level early.
- Default notifications should use the `balanced` preset: actionable or surprising events plus useful setup/runtime reminders, rather than every request.
- The dashboard and logs remain the detailed source of truth; notifications are short prompts to inspect or fix state.
- Together with the status bar and dashboard, notifications cover V1 UI needs without adding a dedicated sidebar view.
- Any user-facing notification text must avoid secrets, raw prompts, raw provider responses, OAuth tokens, and local API keys.
