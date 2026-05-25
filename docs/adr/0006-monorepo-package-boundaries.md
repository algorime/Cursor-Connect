# Monorepo Package Boundaries

Status: accepted

The greenfield V1 will use a monorepo with separate packages for the extension shell, local API server, dashboard/webview UI, and shared types/settings/model metadata.

```text
apps/extension
apps/api
apps/web
packages/shared
```

## Consequences

- The extension package owns Cursor/VS Code activation, commands, always-visible status bar integration, webview hosting, shared runtime coordination, process lifecycle, tunnel lifecycle, and settings integration.
- Command-palette commands should live in `apps/extension` and call the same shared runtime actions used by the dashboard and status bar.
- Extension-owned commands include the full doctor/check setup report; the API provides only narrow health/readiness signals.
- The API package owns the local OpenAI-compatible proxy server, Codex request/response adaptation, and the local non-secret Usage Statistics SQLite database.
- The API package should hide SQLite implementation details behind internal database/repository boundaries so dependency choices do not leak into dashboard or extension code.
- The API runs as a separate local Node/Fastify process supervised by the extension, not as an embedded HTTP server inside the extension host.
- The web package owns the Svelte dashboard UI rendered inside the extension webview and queries Usage Statistics through typed dashboard/API actions.
- The shared package owns cross-package contracts such as Codex model metadata, settings schemas, model resolution types, usage-stat types, and status/event shapes.
- Protocol behavior can be tested independently from extension lifecycle and dashboard UI.
- The repo should avoid a single giant extension package that mixes lifecycle, UI, local server, tunnel, auth, and Codex protocol code.
