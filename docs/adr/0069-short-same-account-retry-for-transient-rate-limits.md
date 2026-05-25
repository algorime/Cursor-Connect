# Short Same-Account Retry For Transient Rate Limits

Status: accepted

For transient Codex rate-limit signals such as `rate_limit_exceeded`, generic `429` with retry-after semantics, or retry-after messages, V1 should not switch Codex Accounts by default. It may perform one short same-account retry only before any Cursor-visible output has been sent.

## Consequences

- Transient rate limits are not subscription exhaustion and should not burn other Codex Accounts through automatic switching.
- If upstream provides a small retry-after, V1 may wait and retry the same Codex Account once before output starts.
- The default maximum hidden wait should be short, such as 10 seconds, to avoid making Cursor Agent appear hung.
- If retry-after is longer than the short threshold, missing, unclear, or output has already started, return a clear retryable error instead of waiting or switching accounts.
- Same-account transient retries must be recorded in Usage Statistics with retry-after, attempt count, safe error category/code, and whether the retry recovered.
- Dashboard/status/notifications may surface repeated or unrecovered transient rate limits according to the user's notification preferences.
