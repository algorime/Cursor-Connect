# Notification Preferences In Setup Guide

Status: accepted

V1 should include notification preferences in the first-run setup checklist so users know extension notifications exist and can choose how noisy or quiet the product should be from the beginning.

## Consequences

- Setup should present notification categories in plain language rather than hiding them deep in settings.
- Users should be able to choose a preset such as important-only, balanced, or verbose, then refine categories later.
- The default preset should be `balanced`.
- Important-only should remain available for users who want minimal interruption.
- Notification categories should include account switching, quota/limits, auth problems, tunnel/API lifecycle, setup reminders, diagnostic recording, and update/repair actions.
- The setup guide should explain that notifications never inject messages into Cursor chat or Cursor Agent context.
- Notification preferences should be editable later from dashboard settings.
- The extension should still surface critical blocking errors in dashboard/status even if optional notifications are disabled.
- Status bar visibility and limit-display preferences should be presented alongside notification preferences because they are both ambient status surfaces.
