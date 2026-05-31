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

### Human testing (extension)

Whenever a human will manually test extension behavior in Cursor (dashboard, commands, runtime, tunnel, auth flows), use the **installed extension in the main Cursor window**, not the F5 Extension Development Host. Do not assume an already-running window is running the latest code.

1. From the repo root: `pnpm run extension:install` (build, package VSIX, install into Cursor).
2. Command Palette → **Developer: Reload Window** (or restart Cursor) in the main window.

Skipping rebuild/reinstall/reload risks validating stale packaged assets (`dist/`, `api/bundle/`, `dashboard/`) from a prior build or install.

**Secondary only — F5 / Extension Development Host:** `.vscode/launch.json` **Run Codex Auth Extension** opens a separate window that loads the extension from `apps/extension` via `--extensionDevelopmentPath` (no VSIX). Use only for extension-host debugging (breakpoints, activation traces, faster edit-reload when packaging is not the question). It is not a substitute for human acceptance testing in the main window.
