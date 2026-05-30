# Harness Workaround Setup Decision Required

Status: superseded by ADR-0122

This ADR described the old Phase 3 posture where setup required an explicit Harness Routing Workaround decision. ADR-0122 supersedes that posture: the Cursor-side routing issue is no longer the normal setup assumption, so the workaround is dormant and no longer blocks Ready Setup.

## Consequences

- `decide later` no longer blocks Ready Setup while the workaround is dormant.
- The dashboard should not present the GPT-5.5-through-GPT-5.4 path as the normal first-run recommendation.
- Diagnostics may keep the workaround visible as historical/fallback compatibility information.
- If the workaround is reactivated later, ADR-0004 still applies: enabling it must be opt-in, visible, and not a hidden rewrite.
