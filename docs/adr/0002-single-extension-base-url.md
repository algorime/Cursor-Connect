# Single Extension Base URL

Status: accepted

Users should paste one Extension Base URL into Cursor rather than switching between model-specific or environment-specific base URLs. This favors a simple user setup; Codex model routing must be resolved from the Cursor-Facing Model ID and extension configuration.

## Consequences

- The extension owns the Cursor-facing model namespace.
- Model route collisions must be handled through model resolution instead of URL paths.
- The dashboard must explain which model IDs to add or select in Cursor.
- The dashboard must pair the Extension Base URL with the generated local API key that Cursor should use for OpenAI-compatible provider authentication.
- The Extension Base URL may come from a health-checked durable user-owned public URL or from the temporary Cloudflare Quick Tunnel path, but Cursor should still receive one canonical URL.
- The dashboard must make clear whether the current canonical URL is durable or temporary because temporary URL changes can require Cursor setup repair.
