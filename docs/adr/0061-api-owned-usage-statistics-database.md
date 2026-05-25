# API-Owned Usage Statistics Database

Status: accepted

The local API package should own the Usage Statistics SQLite database. The API observes completed requests, upstream usage payloads, latency, errors, finish reasons, and account-switch outcomes directly, so it is the correct write boundary for request-level statistics.

The extension and dashboard should read/query Usage Statistics through authenticated/internal API surfaces or extension-mediated actions. Secrets remain in extension-owned SecretStorage and are never stored in the Usage Statistics database.

## Consequences

- `apps/api` owns the SQLite schema, migrations, writes, pruning, aggregation queries, and export data preparation for Usage Statistics.
- `apps/api` should support both global and per-account clear/export operations over local Usage Statistics records.
- `apps/api` should support anonymizing switch-history entries when per-account Usage Statistics are deleted, preserving aggregate operational history without retaining account-specific identifiers for the deleted account.
- `apps/api` should prefer pure JS/WASM SQLite dependencies for V1 and avoid native SQLite bindings unless packaging tests prove they are required.
- `apps/api` records completed request stats, quota cache metadata, account-switch events, and safe operational history as non-secret records.
- `apps/api` should also record failed request metadata, including safe error category/code, latency, stream-started state, and retry/switch details when available.
- Quota cache metadata should store normalized fields and parser/debug metadata, not raw `wham/usage` payloads by default.
- `apps/extension` supervises the API process and surfaces database health/corruption warnings through doctor/dashboard/status, but does not duplicate the database writer.
- `apps/web` renders Usage Statistics by calling typed dashboard/API actions rather than reading SQLite files directly.
- Access to usage-stat query/export endpoints should require the generated local API key or an extension-private channel.
- OAuth tokens, refresh tokens, generated local API keys, raw prompts, raw provider responses, and diagnostic raw captures remain outside the Usage Statistics database.
- If the API is down, the dashboard can show stale cached UI state if available, but the API remains the source of truth for Usage Statistics records.
