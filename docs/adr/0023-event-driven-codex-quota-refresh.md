# Event-Driven Codex Quota Refresh

Status: accepted

V1 should refresh Codex quota/limit status on meaningful events and targeted limited-account reset checks rather than polling constantly. Refresh when the dashboard opens, after each completed Codex request for the relevant Codex Account, after hard-limit events, at known reset times for limited accounts, and when the user clicks manual refresh, with a short cache window around 60-120 seconds.

## Consequences

- The dashboard normally shows fresh enough quota state without continuously calling an undocumented ChatGPT endpoint.
- A completed Codex request should invalidate or refresh the quota cache because it may change the 5-hour or weekly usage windows.
- Quota caches should be account-scoped so auto-switching decisions do not mix limits from different Codex Accounts.
- Manual refresh should bypass or explicitly revalidate the cache for support/debugging.
- Broad background polling should be avoided in V1, but targeted refresh for accounts already marked limited is allowed so reset recovery is not missed.
- Failed quota refresh should not block normal proxy requests; show stale/error state in the dashboard instead.
- If the private quota endpoint changes or becomes unavailable, degrade to quota unavailable/stale and continue proxying requests when live upstream Codex requests still work.
- The cache should record last successful refresh time, last attempted refresh time, and error state when available.
- Cached quota may influence pre-request account switching only while fresh, such as within 120 seconds or immediately after a current-flow refresh.
- Stale, missing, failed, or unparseable quota should not cause a pre-request switch; the live upstream request should be used to discover hard limits instead.
- The quota endpoint should not be called before every Cursor request just because the cache is stale; use live upstream responses as the primary request-time limit detector.
- After a live hard-limit response, refresh quota best-effort to update reset windows and dashboard/status state.
- Limited accounts should be refreshed around known reset times, or on a conservative fallback cadence such as every 5 minutes while the shared runtime is active when no reset time is known.
- Targeted limited-account refresh should be bounded by minimum intervals and back off on repeated quota endpoint failures.
