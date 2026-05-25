# Preserve Cursor Harness When Possible

Status: accepted

Preserving Cursor's model-specific prompt, tool, and agent behavior is a top-level product goal, even when it complicates model routing. The extension should prefer Harness-Routed Models when tests prove that a Cursor built-in model ID still reaches the Extension Base URL, and use aliases or provider-prefixed IDs only when native routing is unavailable or unreliable.

## Consequences

- Clean provider-prefixed IDs are fallback tools, not the default goal for OpenAI-compatible built-in models.
- The model strategy depends on empirical Harness Capture results.
- Cursor-Facing Model IDs and Upstream Model IDs must remain distinct concepts.
