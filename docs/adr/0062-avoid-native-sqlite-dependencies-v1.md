# Avoid Native SQLite Dependencies In V1

Status: accepted

V1 should prefer a pure JavaScript or WASM SQLite implementation for the local Usage Statistics database instead of a native dependency such as `better-sqlite3`, if it can handle the expected small local workload.

Packaging native dependencies across Cursor/VS Code platforms adds installation, ABI, architecture, and update risk. The Usage Statistics workload is local, small, and user-facing rather than high-throughput server analytics, so packaging reliability should outrank maximum SQLite performance in V1.

## Consequences

- Evaluate pure JS/WASM SQLite options first for `apps/api`.
- Avoid native SQLite dependencies by default to reduce platform packaging and support risk.
- Use a native dependency only if pure JS/WASM options fail compatibility, durability, or performance requirements in packaging tests.
- If a native dependency becomes necessary, record a new decision and include platform/ABI packaging, repair, and doctor checks.
- Keep database access behind an internal repository/interface so the storage engine can change without rewriting dashboard or protocol code.
- Usage Statistics performance expectations should be modest: request-level writes, bounded retention, aggregation queries, pruning, and export for local user data.
