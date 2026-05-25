# One-Time Auth Import Export

Status: accepted

Cross-environment Codex auth sharing in V1 should use explicit one-time import/export flows, not continuous token sync. The user must be told what is happening, which environment is the source, which environment is the target, and that the target environment will own refresh from that point onward.

## Consequences

- Do not implement hidden or continuous token syncing across local, Remote SSH, dev container, WSL, or other extension-host environments in V1.
- Syncing non-secret metadata and preferences is allowed separately, but it must not include auth token material or imply the target environment is signed in.
- Import/export should require explicit user action in both wording and UI placement.
- The UI should explain that exported/imported Codex auth material can grant account access in the target environment.
- The UI should explain that after import, the target environment has its own auth state and refresh lifecycle.
- The UI should show source environment, target environment, account identity when available, and last import time.
- One-time import/export should support clipboard-first transfer for convenience and encrypted saved-file transfer as a fallback.
- The UI should warn users to clear clipboard contents or delete transfer files after use.
- If a later refresh in one environment rotates credentials, V1 should not promise that another previously imported environment remains synchronized.
- Prefer signing in directly in each environment when possible; import/export is a convenience and recovery path, not the default onboarding path.
- Cross-environment auth transfer should live under Advanced settings and should not appear in normal first-run setup.
