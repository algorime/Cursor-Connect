# Codex Limit Switching Research

## Question

How should V1 detect Codex/ChatGPT subscription limit hits and safely adapt multi-account Codex Account switching without replaying requests at the wrong time or burning other accounts on transient errors?

## Source Findings

### Existing Proxy

The clean proxy has useful Codex correctness behavior, but no multi-account switching:

- `.sources/cursor-azure-proxy/app/codex/adapter.py` retries once on upstream `401` by forcing token refresh, then re-posting the same request.
- `.sources/cursor-azure-proxy/app/codex/adapter.py` streams upstream responses after the request is posted; non-OK and SSE failures are not classified for account switching.
- `.sources/cursor-azure-proxy/app/codex/auth_state.py` refreshes access tokens under a file lock and maps refresh-token failures such as `refresh_token_expired`, `refresh_token_reused`, and `refresh_token_invalidated`.
- `.sources/cursor-azure-proxy/app/codex/response_adapter.py` captures `response.completed` usage, but `response.failed` and `response.incomplete` are currently converted into assistant-visible text rather than structured terminal failures.

Implication: the greenfield API should preserve same-account `401` refresh/retry, but add a stream supervisor and classifier before failures become Cursor-visible content.

### Ungate

Ungate is useful for UX patterns, but not a limit-switching correctness baseline:

- `.sources/ungate/apps/api/src/proxy/openai-client.ts` posts to the Codex Responses endpoint with `authorization`, `chatgpt-account-id`, `originator: codex_cli_rs`, and `accept: text/event-stream`.
- Its non-OK upstream handling maps errors into generic JSON errors and does not classify hard quota vs transient rate limit vs auth invalid.
- Its Responses stream mapper does not appear to handle `response.failed`, `response.incomplete`, or `error` events as structured terminal events.
- Its OpenAI/Codex request path reads stored credentials directly rather than clearly routing each request through proactive refresh logic.

Implication: do not borrow Ungate's Codex error handling for account switching. Borrow dashboard/status patterns only.

### Public Codex And OpenAI Evidence

Useful source URLs found during research:

- `https://raw.githubusercontent.com/openai/codex/main/codex-rs/codex-api/src/sse/responses.rs`
- `https://raw.githubusercontent.com/openai/codex/main/codex-rs/backend-client/src/client.rs`
- `https://raw.githubusercontent.com/openai/codex/main/codex-rs/codex-api/src/rate_limits.rs`
- `https://raw.githubusercontent.com/openai/codex/main/codex-rs/codex-api/src/error.rs`
- `https://github.com/guyinwonder168/opencode-codex-quota/wiki/Technical-Reference`
- `https://github.com/openai/codex/issues/23171`
- `https://github.com/openai/codex/issues/6512`
- `https://github.com/openai/codex/issues/22054`
- `https://github.com/openai/codex/issues/22144`
- `https://github.com/openai/codex/issues/4161`

Findings:

- Codex source treats `response.failed` as a terminal error, not assistant content.
- Codex source maps `insufficient_quota` to quota exceeded.
- Codex source treats `rate_limit_exceeded` as retryable and parses `try again in ...` style delays.
- Codex source treats `context_length_exceeded` as context-window failure, not quota.
- Codex source treats stream close before `response.completed` as stream error.
- Codex backend client uses `/wham/usage` for ChatGPT backend quota state and maps `rate_limit_reached_type` into explicit reached categories.
- Public quota tools document `rate_limit.allowed`, `rate_limit.limit_reached`, primary/secondary windows, credits, spend-control, and account-scoped quota lookup.
- Public Codex issue evidence shows `used_percent: 100` can be informational or stale while requests still succeed when explicit reached fields are absent.

## Signal Taxonomy

### Hard Quota

Safe default auto-switch signals:

- Fresh quota `allowed=false`.
- Fresh quota `limit_reached=true`.
- Non-null `rate_limit_reached_type`.
- Credits or spend-control depletion when reported.
- HTTP `402` with quota/payment semantics.
- Pre-output HTTP or `response.failed` error classified as `insufficient_quota` or equivalent subscription exhaustion.

Behavior:

- May switch before request if the hard quota state is fresh.
- Fresh for pre-request switching means within the short quota cache window, such as 120 seconds, or refreshed by the current request flow.
- Stale, missing, failed, or unparseable quota should not cause pre-request switching.
- May switch and retry pre-output if no assistant-visible output reached Cursor.
- Must not replay after output started.
- Mark account limited and record switch event/Usage Statistics.
- Keep limited accounts under targeted refresh so reset recovery is detected even while another account is serving requests.
- Recheck around known reset time, or on a fallback cadence such as every 5 minutes while runtime is active when reset time is unknown.

### Transient Rate Limit

Signals:

- `rate_limit_exceeded`.
- Generic `429` without hard quota body.
- Retry-after headers or messages.
- `server_is_overloaded` or `slow_down`.

Behavior:

- Do not switch by default.
- One short same-account retry may be used before output when upstream provides a small retry-after, such as up to 10 seconds.
- If retry-after is longer than the short threshold, missing, unclear, or output has already started, return a clear retryable error rather than waiting or switching accounts.
- Record retry-after/status/error category.

### Auth Invalid

Signals:

- Local missing tokens.
- Upstream `401` after forced same-account refresh.
- Refresh failures such as `refresh_token_expired`, `refresh_token_reused`, or `refresh_token_invalidated`.

Behavior:

- First try one forced refresh on access-token rejection.
- Mark account auth-required if refresh fails.
- Do not classify as quota.
- Skip the account for future automatic selection when multi-account auto-switching is enabled; otherwise fail clearly with auth required.
- Do not silently delete, logout, or remove the auth-invalid account.

### Account Temporarily Unusable

Signals:

- Session/challenge/Cloudflare-like errors.
- Repeated account-specific `403` or HTML challenge responses.
- Account disabled or workspace permission state.

Behavior:

- Do not assume quota.
- Mark account temporarily unusable or requiring user review.
- Do not skip automatically by default.
- Switch only if an advanced policy permits skipping temporarily unusable accounts and no output has started.
- Record whether advanced skip was enabled and keep the account visible for user review.

### Request Invalid Or Context/Incomplete

Signals:

- `invalid_request`, `invalid_prompt`, unsupported model/tool/schema.
- `context_length_exceeded`.
- `response.incomplete` and incomplete/truncation reasons.
- `cyber_policy`, `usage_not_included`.

Behavior:

- Do not switch accounts.
- Surface/record safe failure details.
- Account remains healthy unless separate auth/quota signal exists.

### Provider Outage Or Unknown

Signals:

- `5xx`.
- Network timeout.
- Stream closed before `response.completed`.
- Unknown quota schema, unknown `plan_type`, parse errors.

Behavior:

- Do not switch by default.
- Record provider-degraded/unknown category.
- Mark quota stale/error when relevant.

## Implementation Implications

- Add pure classifier functions for HTTP errors, Responses SSE events, quota snapshots, and output-start detection.
- Back those classifier functions with protocol fixtures before live upstream testing, including `response.failed`, `response.incomplete`, hard quota, transient rate limit, auth invalid, context failure, and stream-close cases.
- Supervise upstream SSE before flushing Cursor-visible chunks so pre-output failures can be classified and retried safely.
- Treat `response.failed` and `response.incomplete` as structured terminal events before rendering; do not convert them directly into assistant content in the switching path.
- Track one attempt per eligible Codex Account, one forced token refresh per account per original request, and one short same-account retry for eligible transient rate limits.
- Record safe Usage Statistics fields: signal category, safe code/type, HTTP status, SSE terminal event, output-started flags, quota snapshot age, switch reason, attempted accounts, final serving account, and usage tokens when upstream provides them safely.
- Distinguish whether a switch was caused by fresh cached quota or by the live upstream request response.
- If no eligible account remains, fail fast with a clear OpenAI-compatible error rather than holding the Cursor request until reset; keep targeted refresh running outside the request.
- Manual-only accounts are not blocked automatic accounts; record them as skipped by policy and expose explicit manual switch actions.
- Manual switching may override automatic eligibility for accounts marked limited or temporarily unusable after warning/confirmation, but it should not clear those states until a successful request, fresh quota, or repair proves recovery. Auth-required accounts need reauthentication before selection.
- When recovery is proven, clear only the stale runtime state; preserve user policy such as manual-only status, auto-switch exclusion, and priority order.

## Recommendation

Use conservative allowlist-based switching. The default should optimize for not corrupting Cursor Agent state and not consuming other accounts unnecessarily. Automatic switching is justified only for hard quota before output starts; all other classes should fail clearly, retry same account only when safe, or require user action.

Auto-switching should remain off until explicitly enabled. Adding a second Codex Account should strongly recommend the hard-limits-only policy because that is the continuity use case, but account use must not be surprising or silent.

Limit detection should be hybrid rather than quota-polling-driven: live upstream request responses are the primary request-time source of truth, while `wham/usage` quota refresh is event-driven for dashboard/status/reset estimates and fresh cached pre-request optimization. Do not block every request on quota refresh when the cache is stale.

Limited-account reset detection is a targeted exception to "no polling": once an account is known limited, refresh it around known reset times or on a bounded fallback cadence so the dashboard and switch policy know when it becomes usable again.
