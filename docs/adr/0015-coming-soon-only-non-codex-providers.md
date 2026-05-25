# Coming-Soon Only Non-Codex Providers

Status: superseded by [0021 Codex Auth-First V1](0021-codex-auth-first-v1.md)

V1 was previously allowed to show non-Codex providers only as Coming-Soon Providers. This has been narrowed further: V1 should fully forget non-Codex providers in the product UI and focus on Codex auth and usage.

## Consequences

- Codex is the only active integration in V1.
- Other provider cards should not appear in the dashboard for V1 product direction.
- Generic infrastructure naming is allowed where it is already needed by Codex Auth-First V1: extension shell, dashboard layout, local API lifecycle, tunnel lifecycle, setup status, logs, settings, and shared status/model metadata types.
- V1 should avoid building provider abstractions that exist only for hypothetical future providers.
- The harness capture evidence matters: literal `custom` reached the Extension Base URL but lost Cursor's richer OpenAI-family Responses-shaped harness, native reasoning controls, prompt cache retention, conversation metadata, and tool schema shape.
- Future providers should become Enabled Providers only after a Harness Capture or equivalent proof shows an acceptable Cursor-Facing Model ID strategy, or after the product deliberately accepts the weaker custom-model harness trade-off.
