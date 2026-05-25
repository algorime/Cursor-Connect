# Fresh Quota Required For Pre-Request Switching

Status: accepted

V1 may use cached Codex quota state to switch Codex Accounts before sending a request only when that quota state is fresh. Stale, missing, failed, or unparseable quota data should not cause a pre-request switch because the private quota endpoint can lag behind actual request behavior.

## Consequences

- A quota snapshot should be considered fresh for pre-request switching only within the short cache window, such as 120 seconds, or when it has just been refreshed by the current request flow.
- Fresh quota can prevent a doomed request when it shows hard-limit evidence such as `allowed=false`, `limit_reached=true`, or non-null `rate_limit_reached_type`.
- Stale or unavailable quota should show stale/error state in dashboard/status, but should not preemptively move traffic away from the Active Codex Account.
- When quota is stale/unavailable, send with the Active Codex Account unless another non-quota eligibility rule blocks it, then rely on the real upstream response to trigger pre-stream retry if a hard limit is returned.
- Do not turn stale quota into a blocking pre-request quota refresh; the real upstream response is the primary request-time limit signal.
- Usage Statistics and switch history should record quota snapshot age, whether quota was fresh enough for pre-request switching, and whether the switch was caused by cached quota or by the live request response.
- Targeted refresh may make a previously limited account eligible again, but only fresh refreshed quota should affect pre-request switching.
