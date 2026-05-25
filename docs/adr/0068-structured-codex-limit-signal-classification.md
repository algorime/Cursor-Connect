# Structured Codex Limit Signal Classification

Status: accepted

V1 should classify Codex HTTP errors, Responses SSE terminal events, quota snapshots, and auth failures into structured signal categories before deciding whether to retry, switch Codex Accounts, mark quota state, or surface an error. Account switching must be conservative and allowlist-based because Codex/ChatGPT subscription limit signals are partly private and may change.

## Consequences

- Hard quota signals may trigger automatic switching when the Codex Account Switch Policy allows it: fresh quota `allowed=false`, fresh quota `limit_reached=true`, non-null `rate_limit_reached_type`, credits/spend-control depletion, HTTP `402` with a quota/payment body, or pre-output `response.failed`/HTTP error classified as `insufficient_quota` or equivalent subscription exhaustion.
- Quota-derived hard-limit signals can cause pre-request switching only when the quota snapshot is fresh enough for switching decisions.
- Live upstream request responses are the primary hard-limit signal source during Cursor requests; quota snapshots are secondary cached evidence.
- `used_percent >= 100` alone must not trigger default switching because it can be informational or stale when requests are still allowed.
- `rate_limit_exceeded`, generic `429`, retry-after messages, `server_is_overloaded`, `slow_down`, `5xx`, stream disconnects, and network timeouts are transient rate-limit/provider-degradation signals by default, not subscription exhaustion.
- Transient `rate_limit_exceeded`/`429` signals may get one short same-account pre-output retry when upstream provides a small retry-after, but should not trigger Codex Account switching by default.
- `401` should first force-refresh the same Codex Account once. Refresh-token failures such as `refresh_token_expired`, `refresh_token_reused`, or `refresh_token_invalidated` mark the account auth-required; they are not quota events.
- When multi-account auto-switching is enabled, accounts marked auth-required should be skipped for future automatic selection until the user reauthenticates or repairs them.
- `403` should not trigger switching unless the body is clearly classified as subscription/usage exhaustion; otherwise treat it as auth/session/permission review.
- Ambiguous session/challenge/Cloudflare-like/account-disabled/workspace-permission signals should mark the account temporarily unusable or needing review, not quota-limited.
- Temporarily unusable accounts should not be skipped automatically by default; advanced policy may allow pre-output skip with visible switch history.
- `context_length_exceeded`, `invalid_prompt`, `invalid_request`, `cyber_policy`, `usage_not_included`, and `response.incomplete` should not trigger account switching.
- A pre-output hard quota signal may switch and retry on the next eligible Codex Account. After any assistant-visible text, reasoning display content, or tool-call delta has reached Cursor, never replay the request on another account.
- The local API should keep structured classifiers separate from response rendering so `response.failed` and `response.incomplete` are not converted into ordinary assistant content before switch decisions are made.
- Retry loops should be bounded to at most one attempt per eligible Codex Account for hard-quota switching, one forced token refresh per account per original request, and one short same-account retry for eligible transient rate limits.
- Usage Statistics should record safe signal category, safe code/type, HTTP status, SSE terminal event, whether output had started, quota snapshot freshness, switch reason, attempted accounts, and final serving account.
- Usage Statistics should distinguish switches caused by fresh cached quota from switches caused by the live upstream request response.
- Usage Statistics should record the limit detection source, such as live upstream response, fresh cached quota, manual refresh, dashboard refresh, or stale/error quota state.
