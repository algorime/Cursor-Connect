# Codex Usage Statistics Research

## Product Direction

The user rejected external telemetry but wants useful local Codex usage statistics, especially limits and anything else helpful. V1 is now Codex auth-first, so usage stats should be Codex-specific rather than provider-general analytics.

## Local Request Statistics

The current proxy already proves useful token accounting is available from upstream response usage payloads:

- `app/codex/response_adapter.py` captures `response.usage` from completed Responses events.
- It maps usage into Chat Completions-style fields: `prompt_tokens`, `completion_tokens`, `total_tokens`, `prompt_tokens_details.cached_tokens`, and `completion_tokens_details.reasoning_tokens`.
- `app/azure/response_adapter.py` logs `USAGE: input=... cached=... output=... reasoning=... total=...`.
- `app/common/token_usage_report.py` can parse and summarize usage records, including cached tokens, non-cached tokens, reasoning tokens, totals, cache hit rate, request counts, and input-token percentiles.

Ungate provides useful local analytics/dashboard patterns, but V1 should not copy its estimated-cost behavior:

- `apps/api/src/database/schema.ts` has a local `requests` table with timestamp, model, source, input/output tokens, estimated cost, stream, latency, and error.
- `apps/api/src/database/analytics.ts` summarizes request counts and token series by hour/day/week/month.
- `apps/api/src/routes/analytics.ts` exposes local analytics endpoints and reset.
- `apps/web/src/features/analytics/*` renders request lists, token charts, stat cards, and reset UX.

V1 should borrow the local-dashboard idea, but specialize it for Codex and extend it with Codex Account attribution, cached input tokens, reasoning tokens, upstream model, Cursor-Facing Model ID, finish reason, and quota status. Do not include spend or per-token money estimates because ChatGPT subscription limits are the actual user constraint.

Failed requests should be included in Usage Statistics without prompt bodies or raw provider payloads. Useful failure fields include timestamp, Codex Account, Cursor-Facing Model ID, Upstream Model ID when resolved, request shape, latency, HTTP status, safe error category/code, whether stream output started, retry/switch details, quota snapshot freshness, SSE terminal event, and token usage only if upstream provides it safely.

Recovered pre-stream retries should be visible as compact switch/retry events in the primary timeline rather than hidden only in request details. This preserves UX continuity when the final request succeeds while still explaining why the Active Codex Account changed.

Account switching should use structured signal classification. Safe hard-quota signals include fresh `allowed=false`, fresh `limit_reached=true`, non-null `rate_limit_reached_type`, credits or spend-control depletion, HTTP `402` with quota/payment semantics, and pre-output `response.failed` or HTTP errors classified as `insufficient_quota` or equivalent subscription exhaustion. `used_percent >= 100` alone should not switch because public Codex issue evidence shows it can be informational while requests still succeed. Generic `429`, `rate_limit_exceeded`, retry-after messages, provider `5xx`, network failures, `response.incomplete`, context-length failures, and invalid requests should not switch by default.

Transient rate-limit signals may use one short same-account pre-output retry when upstream provides a small retry-after, such as up to 10 seconds. Longer, unclear, or post-output transient limits should return a retryable error instead of switching Codex Accounts.

Auth-invalid accounts should be skipped for future automatic selection when multi-account auto-switching is enabled, after one forced same-account refresh attempt fails or required token material is missing. This is not a quota event: Usage Statistics should record safe auth category/code, refresh-attempt state, skipped account, fallback account if any, and final serving account.

Temporarily unusable accounts from ambiguous session/challenge/`403`/Cloudflare-like/workspace signals should be review-first rather than auto-skipped by default. If the user enables an advanced skip-temporarily-unusable policy, Usage Statistics should record the safe category/code, whether the advanced policy was enabled, skipped account, fallback account if any, and final serving account.

Request-level usage history should be retained only within a bounded local window by default, such as 30 days or a conservative size cap. The dashboard should provide clear and export actions so users can remove local history or package relevant records for support/debugging. Aggregates should be derived from retained local records rather than an unbounded shadow history.

Clear/export should work globally and per Codex Account. Per-account operations are important for multi-account users who want to manage one account's local history without deleting all local Usage Statistics. Clearing Usage Statistics should not log out accounts unless the user explicitly chooses account removal/logout.

Usage exports should hash request IDs, session IDs, Cursor conversation IDs, and similar correlation identifiers by default. Raw identifiers are useful for support correlation but may be sensitive, so they should be available only through an explicit advanced export option. This is separate from diagnostic raw capture and should not include prompt bodies.

Store local non-secret Usage Statistics in an `apps/api`-owned SQLite database rather than ad hoc JSON files. The data needs filtering, pruning, aggregation, multi-account attribution, switch-event history, and export. SQLite should store request stats, quota cache metadata, switch events, and operational history, while secrets remain in SecretStorage and raw diagnostic captures remain separate. The extension/dashboard should query stats through authenticated/internal API surfaces instead of reading SQLite files directly.

Prefer pure JavaScript or WASM SQLite for V1 if it satisfies the small local workload. Avoid native SQLite bindings by default because Cursor/VS Code extension packaging across platforms is a bigger risk than raw database performance for this use case.

Multi-account support means local request stats should be attributable by Codex Account. The dashboard should default to an aggregate overview across all accounts, highlight the Active Codex Account, offer per-account drill-down, and mark account-switch events so users can understand which account served each request.

The UI should be rich and user-oriented: account health cards, quota window bars, cache-hit summaries, token breakdowns, reasoning-token totals, latency/error trends, and a switch-event timeline are more useful than a raw request table as the first view. Request tables can remain available for details and export.

## Codex Limit/Quota Signals

Public reverse-engineered tools document a private ChatGPT usage endpoint:

```text
GET https://chatgpt.com/backend-api/wham/usage
Authorization: Bearer <access_token>
Accept: application/json
ChatGPT-Account-Id: <account_id>
```

References found:

- `https://github.com/robinebers/openusage/blob/main/docs/providers/codex.md`
- `https://github.com/guyinwonder168/opencode-codex-quota/wiki/Technical-Reference`
- Search results for `pi-codex-status` and `show-codex-usage` report the same endpoint and similar schema.

The endpoint is undocumented/internal and may change. Reported fields include:

- `plan_type`
- `rate_limit.allowed`
- `rate_limit.limit_reached`
- `rate_limit_reached_type` when present
- `rate_limit.primary_window.used_percent`
- `rate_limit.primary_window.reset_at`
- `rate_limit.primary_window.reset_after_seconds`
- `rate_limit.primary_window.limit_window_seconds`
- `rate_limit.secondary_window` with the same shape
- `code_review_rate_limit`
- `additional_rate_limits`
- `credits.has_credits`
- `credits.unlimited`
- `credits.balance`
- `credits.approx_local_messages`
- `credits.approx_cloud_messages`
- `spend_control.reached`

Display ideas:

- Plan type and signed-in Codex Account.
- 5-hour and weekly windows when present.
- Remaining percentage as `100 - used_percent`, clamped for bars but preserving raw value in details.
- Reset time in local time and relative duration.
- Whether requests are currently allowed or a limit is reached.
- Credits balance/status when present.
- Additional named limits if the response includes them.
- Last successful refresh time and stale/error state.

Implementation posture:

- Treat this endpoint as best-effort and unofficial.
- Query per Codex Account when the dashboard opens, after completed Codex requests for that account, and on manual refresh, with a conservative 60-120 second cache window rather than aggressive polling.
- For accounts marked limited, perform targeted refresh around known reset times, or on a reasonable fallback cadence such as every 5 minutes while the shared runtime is active when no reset time is known.
- Use cached quota for pre-request account switching only while fresh, such as within 120 seconds or immediately after a current-flow refresh.
- If quota is stale, missing, failed, or unparseable, show stale/error state but do not preemptively switch accounts from quota alone.
- Do not call the quota endpoint before every Cursor request just because the cache is stale; live upstream responses are the primary request-time hard-limit detector.
- After a live hard-limit response, refresh quota best-effort to update reset windows, account state, dashboard/status display, and Usage Statistics.
- Never log tokens or full endpoint responses by default.
- Normalize quota responses and discard raw `wham/usage` payloads by default. Store only displayed/used fields plus parser version, unknown-field count, and parse warnings.
- Do not treat `used_percent >= 100` as authoritative without explicit hard-limit fields.
- Gracefully degrade if the endpoint returns unknown schema, 401/403, 404, or network errors.
- Do not block normal proxy requests if usage lookup fails.
- Treat private quota-surface failure as a Usage Statistics/status degradation, not a Codex proxy failure, when auth and live upstream requests still work.
- Surface safe statuses such as `quota_unavailable` or `quota_stale`; do not store raw failed quota payloads.

## V1 Recommendation

Implement two local usage surfaces:

- Local request stats from actual proxied traffic: reliable, owned, always local.
- Codex quota/limit status from `wham/usage`: useful but unofficial, account-scoped, cached, and clearly labeled as best-effort.

Quota refresh should be event-driven plus targeted for limited-account reset recovery: dashboard open, completed Codex request, hard-limit event, known reset time, limited-account fallback recheck, or manual refresh. Failed refreshes should surface a stale/error state but must not block normal proxy usage.

Limit detection should be hybrid: actual upstream responses drive request-time switching, while cached quota drives UX, reset estimates, and pre-request optimization only when fresh.

Do not implement external telemetry. Do not include spend estimates. Do not persist prompt bodies in usage stats. Keep raw request/response capture behind the separate diagnostic recording mode.

Auto-prune request-level usage history by default, while keeping manual clear/export controls in the dashboard.

Support multiple Codex Accounts by attributing requests, quota state, account switches, and errors to the account involved.

When no eligible Codex Account can serve a request, record the failed request with attempted/skipped accounts, blocking reasons, earliest known reset when available, and no serving account. The dashboard/status should show reset and repair actions, but the Cursor request should fail fast rather than wait for reset.

Manual-only accounts should be separated from blocked account status. If auto-switching skips a manual-only account, record it as skipped by policy and show it as an explicit manual-switch option rather than as blocked.

Default to aggregate-first UX with Active Codex Account highlighted and per-account drill-down.
