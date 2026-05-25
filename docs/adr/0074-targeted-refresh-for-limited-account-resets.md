# Targeted Refresh For Limited Account Resets

Status: accepted

When a live request or fresh quota proves a Codex Account is hard-limited, V1 should keep checking that limited account at a reasonable targeted cadence so the user can know when it resets even if another Codex Account is currently serving requests. This should not become hot-path quota polling before every Cursor request.

## Consequences

- A hard-limited Codex Account should remain marked limited until the earliest reliable reset time, a fresh quota refresh shows it is allowed again, or the user manually refreshes/repairs the account.
- If a reset time is known, schedule a best-effort refresh around that reset time, with jitter/backoff so multiple accounts do not refresh at once.
- If no reset time is known, use a conservative fallback recheck cadence for limited accounts, such as every 5 minutes while the shared runtime is active.
- Manual refresh should always be available and should revalidate the selected account or all accounts depending on dashboard context.
- Targeted limited-account refresh should be account-scoped, bounded by a minimum interval, and should back off on repeated quota endpoint failures.
- These refreshes update dashboard/status/Usage Statistics and can make a recovered account eligible again, but they should not block normal Cursor requests.
- Targeted refresh should continue after a no-eligible-account failure so limited accounts can become eligible later without holding the failed Cursor request open.
- Usage Statistics should record refresh source: reset-timer, fallback-limited-recheck, dashboard-open, manual, completed-request, hard-limit-event, or live-request signal.
