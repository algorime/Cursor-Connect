# Local Codex Usage Statistics, No Telemetry

Status: accepted

V1 should not include external telemetry or analytics. It should include local Codex usage statistics that help the user understand requests, token usage, cache behavior, reasoning tokens, errors, latency, and available Codex limits when those can be queried safely.

## Consequences

- No usage, diagnostics, auth, model, tunnel, or error data should be sent to any extension-owned analytics service in V1.
- Usage statistics are local product features for the user, not telemetry for the developer.
- Local request stats should include request count, Codex Account, model, Cursor-Facing Model ID, Upstream Model ID, timestamp, latency, status/error, input tokens, cached input tokens, output tokens, reasoning tokens, and total tokens when available.
- Usage Statistics should include failed requests as local records with safe error/category/latency/retry/switch metadata, but without prompt bodies or raw provider payloads.
- Usage Statistics should not include estimated spend or per-token money calculations in V1; ChatGPT subscription limit windows are the relevant user limits.
- Dashboard usage views can borrow from Ungate's local analytics idea, but should be Codex-specific and should not store prompt bodies by default.
- Local non-secret Usage Statistics should be stored in an `apps/api`-owned SQLite database rather than ad hoc JSON files.
- Usage Statistics should default to a rich aggregate overview across all Codex Accounts, with the Active Codex Account highlighted and per-account drill-down available.
- Codex limit/quota status may use known private ChatGPT usage signals if implemented defensively and labeled as unofficial/unstable.
- If private quota/limit lookup breaks, normal request proxying should continue when auth/upstream requests still work, while Usage Statistics shows quota unavailable or stale.
- Codex limit/quota responses should be normalized and raw upstream quota payloads discarded by default.
- Codex limit/quota status should refresh when the dashboard opens, after completed Codex requests, and on manual refresh, with a short cache window rather than constant polling.
- Codex limit/quota status should also feed the configurable status bar limit display when available.
- Usage Statistics should be filterable/grouped by Codex Account and should make account switches visible when they affect requests.
- Account switch events should appear in history/timeline views with reason, source account, target account, and whether the switch affected the current request or a future request.
- Recovered pre-stream retries should appear as compact switch/retry events in primary timeline views so successful requests still explain why account switching happened.
- Account switch events may trigger configurable extension notifications, but should not be injected into Cursor chat content.
- Request-level usage history should be auto-pruned by default, such as 30 days or a conservative size cap, and should stay in extension-owned local storage.
- Usage and limit data should be clearable and exportable from the dashboard, both globally and per Codex Account.
- Usage exports should hash request/session/conversation identifiers by default while offering raw identifiers only as an explicit advanced export option.
- Diagnostic raw captures remain separate from normal usage statistics and require explicit opt-in.
