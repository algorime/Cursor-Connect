# State-Aware Dashboard Home

Status: accepted

The dashboard should use one state-aware home screen instead of separate competing setup and normal-mode landing pages. The first visible content should adapt to the current product state.

## Consequences

- Before setup is complete, the home screen should prioritize the setup checklist rather than a strict blocking wizard.
- After setup is complete, the home screen should prioritize Codex status, Active Codex Account, quota, and Usage Statistics.
- If a blocking problem appears, such as expired auth, tunnel failure, local API failure, or incomplete Cursor setup, the home screen should promote that problem above normal usage views.
- If setup is incomplete for an obvious user action such as missing Codex auth, missing public route verification, or missing Cursor confirmation, the home screen should offer the direct setup action before sending the user to doctor.
- Doctor is a diagnosis and recovery path, not the primary call to action for normal first-run setup steps.
- The home screen should identify the active runtime environment when that matters, such as local, Remote SSH, dev container, or WSL.
- Secondary pages may still exist for details, logs, settings, diagnostics, and history, but the default landing page should always answer "what should I do or know right now?".
- Dashboard routing should derive the landing content from runtime state rather than relying on a permanent first-run page.
