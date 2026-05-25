# Auth Transfer Advanced Only

Status: accepted

Cross-environment Codex auth transfer should be hidden under Advanced settings in V1. It should not appear in normal first-run setup.

The normal setup path should guide users toward built-in Codex OAuth first, with explicit `~/.codex/auth.json` import as the ordinary fallback. Cross-environment import/export is powerful and risky because it moves auth material between environments, so it should be available only to users who intentionally look for advanced auth controls.

## Consequences

- Do not include cross-environment auth transfer in the default first-run checklist.
- Keep built-in OAuth as the primary sign-in path.
- Keep explicit Codex CLI auth import as the normal fallback/recovery path.
- Place cross-environment auth export/import under Advanced with warnings before export and before import.
- Advanced UI should explain that transfer payloads contain Codex auth material and can grant account access in the target environment.
- Support and troubleshooting docs may reference the feature, but product onboarding should not promote it to ordinary users.
