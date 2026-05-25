# Reasoning Display Controls

Status: accepted

V1 should include reasoning display controls. The default should hide reasoning text from normal chat output while preserving native reasoning metadata in streamed chunks for any future Cursor support.

## Consequences

- Default reasoning display mode should be `none`: do not inject thinking text into assistant-visible chat content.
- The response adapter should continue preserving native reasoning metadata fields where possible, even though current Cursor BYOK/custom OpenAI routing did not render native thinking blocks during testing.
- Markdown or visible `<think>` fallback display should be available only as an advanced explicit setting for users who prefer seeing reasoning despite degraded UX.
- The dashboard should explain that native Cursor thinking blocks are not currently solved for the Extension Base URL path.
- V1 should not claim 1:1 native thinking UI until a future Harness Capture or Cursor behavior change proves it.
- Protocol fixtures should verify that default `none` mode hides reasoning text from assistant-visible chat output while preserving native reasoning metadata fields where possible.
- This keeps the product aligned with the user's preference to avoid ugly Markdown reasoning blocks while retaining protocol evidence for future Cursor support.
