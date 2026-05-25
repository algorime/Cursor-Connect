# Global Codex Instructions

## Subagent Model Selection

Use GPT-5.5 only for spawned subagents. Do not choose older GPT-5.x models for delegation unless the user explicitly overrides this instruction.

Select only the reasoning effort level for the task:

- `none`: use for truly trivial delegated tasks where no meaningful reasoning is needed, such as mechanical lookups, simple file presence checks, exact text searches, tiny formatting checks, or reporting one obvious command result.
- `low`: default for most straightforward exploration, simple implementation, quick checks, bounded reviews, and routine repo inspection. Low is still highly capable and should be preferred unless stronger reasoning is clearly useful.
- `medium`: use for genuinely serious coding, architecture review, multi-file analysis, ambiguous debugging, and tasks where stronger reasoning materially improves quality. Medium is already SOTA-level reasoning; do not use it as the default.
- `high`: use only for maximum-performance work: critical reviews, difficult debugging, security-sensitive analysis, complex architecture, or when a lower-effort subagent is blocked.

When spawning a subagent, leave the model as inherited GPT-5.5 where possible and set only `reasoning_effort` to `none`, `low`, `medium`, or `high`.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo: read root `CONTEXT.md` and root `docs/adr/`. See `docs/agents/domain.md`.
