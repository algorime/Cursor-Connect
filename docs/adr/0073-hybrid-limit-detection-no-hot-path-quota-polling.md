# Hybrid Limit Detection, No Hot-Path Quota Polling

Status: accepted

V1 should detect Codex Account limits primarily from live upstream request responses, not by polling the private quota endpoint before every Cursor request. The quota endpoint should support dashboard/status UX, reset estimates, and cached pre-request optimization only when already fresh.

## Consequences

- Live upstream HTTP errors and Responses SSE terminal events are the primary source of truth for request-time hard-limit detection.
- Pre-output hard-limit responses such as `insufficient_quota`, quota/payment `402`, or classified hard-limit `response.failed` may trigger Codex Account switching and retry.
- The private quota endpoint should refresh on dashboard open, manual refresh, after completed requests, after hard-limit events, and targeted limited-account reset checks to update account state and reset estimates.
- Stale quota should not cause a pre-request switch and should not force a blocking quota refresh before every request.
- Once a live request proves a Codex Account is hard-limited, the extension may mark that account limited until a known reset time, fresh quota refresh, or user action clears the state.
- Limited accounts should be rechecked around known reset times or on a reasonable fallback cadence, such as every 5 minutes while runtime is active when no reset time is known.
- Background/event-driven quota refresh should be best-effort and should not block normal proxy requests.
- Usage Statistics should distinguish limit detection source: live upstream response, fresh cached quota, manual quota refresh, dashboard refresh, or stale/error quota state.
