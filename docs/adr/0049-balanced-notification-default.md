# Balanced Notification Default

Status: accepted

The first-run setup guide should default notification preferences to `balanced`, while clearly offering `important-only` and `verbose` as alternatives.

## Consequences

- `balanced` should include actionable or surprising events plus useful setup/runtime reminders, without notifying on every normal request.
- `important-only` remains available for users who want minimal interruption.
- `verbose` remains available for users who want more operational visibility.
- The setup guide should make the default visible rather than silently selecting it.
- Users should be able to change the preset and individual notification categories later from dashboard settings.
- Critical blocking states should still be visible in dashboard/status even if a user selects quieter notification settings.
