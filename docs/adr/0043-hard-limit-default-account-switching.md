# Hard-Limit Default Account Switching

Status: accepted

When Codex Account auto-switching is enabled, V1 should switch on hard limits by default rather than preemptively switching near a limit. Advanced users may configure preemptive thresholds, but that should be an explicit advanced policy choice.

## Consequences

- Default auto-switch trigger should be hard limit evidence: fresh `allowed=false`, fresh `limit_reached=true`, non-null `rate_limit_reached_type`, exhausted 5-hour or weekly window, credits/spend-control depletion, HTTP `402` with a quota/payment body, a quota/limit error such as `insufficient_quota`, or an account becoming temporarily unusable under the user's policy.
- Do not switch by default just because an account is near a limit.
- Do not switch by default just because `used_percent >= 100`; that value can be stale or informational unless paired with an explicit not-allowed/limit-reached signal.
- Do not switch by default on generic `429`, `rate_limit_exceeded`, retry-after messages, `5xx`, network failures, context-length errors, invalid requests, or `response.incomplete`.
- A small retry-after on a transient rate limit may be handled by one short same-account pre-output retry instead of switching.
- Advanced settings may allow preemptive thresholds, such as switching when a primary or secondary quota window exceeds a user-chosen percentage.
- The dashboard should show whether the policy is hard-limit-only or threshold-based.
- Switch history should record whether a switch happened because of a hard limit, upstream error, manual action, or preemptive threshold.
- Hard-limit switching should retry the current request only when the limit is known before any assistant-visible stream output reaches Cursor.
- If quota state is stale or unavailable, the extension should avoid speculative switching unless the current request receives a hard limit/auth error.
- Cached quota should be considered fresh enough for pre-request switching only within the short quota cache window, such as 120 seconds, or after a current-flow refresh.
- Auth failures should be handled before quota switching: force-refresh the same Codex Account once on access-token rejection, then mark auth-required if refresh fails rather than treating it as quota exhaustion.
