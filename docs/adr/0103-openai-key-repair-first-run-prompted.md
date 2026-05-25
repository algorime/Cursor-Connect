# OpenAI Key Repair First-Run Prompted

Status: accepted

V1 should include Ungate-style Cursor OpenAI-key enabled-state repair as a recommended setup option, but it should be first-run prompted rather than silently default-on. The repair depends on private Cursor storage/commands, so the user should explicitly choose it after seeing the compatibility warning.

This keeps the useful workaround available while respecting the automation boundary: stable/owned setup steps can be automated directly; private Cursor behavior must be clearly labeled and user-enabled.

## Consequences

- The first-run setup checklist should include a step for `Keep Cursor OpenAI API key enabled`.
- The setup UI should recommend enabling it when runtime capability checks show the Ungate-style mechanism appears available.
- The UI must explain that this is a Cursor workaround using private behavior and may break after Cursor updates.
- The user chooses enable, skip, or decide later; V1 should not silently enable the repair before user choice.
- If enabled, the repair remains switchable later from settings/dashboard.
- Runtime detection should guard the feature: required command/storage shape must be present, otherwise show unavailable with explanation.
- This repair only concerns Cursor's OpenAI API-key enabled toggle. It does not permit silently setting Base URL, API key, Verify/Save state, custom model IDs, or other private Cursor settings.
- Failure of the repair should degrade to manual setup instructions and doctor warnings, not block the local API or Codex auth.
