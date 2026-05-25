# SQLite For Local Usage Statistics

Status: accepted

V1 should store local non-secret Usage Statistics in SQLite rather than ad hoc JSON files. Usage Statistics need filtering, pruning, aggregation, multi-account attribution, switch-event history, and export; SQLite fits those requirements better while staying local.

Secrets remain outside SQLite in VS Code/Cursor SecretStorage.

## Consequences

- Store request-level usage records, account-scoped quota cache metadata, switch events, operational history, and aggregate-friendly non-secret stats in a local SQLite database owned by `apps/api`.
- Do not store OAuth access tokens, refresh tokens, ID tokens, imported Codex CLI token material, generated local API keys, raw prompts, raw provider responses, or diagnostic raw captures in the Usage Statistics database.
- SQLite schema should support Codex Account attribution, Cursor-Facing Model ID, Upstream Model ID, token fields, cached token fields, reasoning tokens, latency, status/error, finish reason, and switch-event references.
- Auto-pruning and clear/export controls should operate over SQLite records.
- Aggregates should be computed from retained records, with indexes for dashboard queries and exports.
- Diagnostic raw captures remain separate files/directories governed by diagnostic recording mode.
- If SQLite is unavailable or corrupted, the extension should surface a recoverable dashboard/doctor warning rather than blocking core proxy use where possible.
- The extension and dashboard should query Usage Statistics through authenticated/internal API surfaces rather than reading SQLite files directly.
