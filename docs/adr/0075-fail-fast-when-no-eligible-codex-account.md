# Fail Fast When No Eligible Codex Account

Status: accepted

When every automatic-eligible Codex Account is limited, auth-required, temporarily unusable without an advanced skip policy, or otherwise unable to serve the request, V1 should return a clear OpenAI-compatible error immediately rather than holding the Cursor request until a future reset. Manual-only accounts should be reported separately as manually selectable, not as blocked automatic accounts.

## Consequences

- The local API should not keep Cursor Agent requests open waiting minutes for subscription windows to reset.
- The error returned to Cursor should be OpenAI-compatible and safe, with a clear category such as no eligible Codex Account, all accounts limited, auth required, or account repair required.
- Dashboard and status bar should show the earliest known reset time, blocked account states, and available user actions such as manual refresh, reauth, account reorder, or manual switch.
- If manual-only accounts exist, dashboard/status should show them as explicit manual-switch options rather than counting them as blocked automatic accounts.
- If reset time is unknown, the UI should say so and rely on targeted limited-account refresh plus manual refresh.
- Notifications may alert the user according to preferences when all automatic accounts are blocked.
- Usage Statistics should record the failed request, attempted/skipped accounts, blocking reasons, earliest reset if known, and that no serving account was available.
- Manual-only accounts skipped during auto-switch should be recorded as skipped by policy, not blocked by quota/auth/error.
- The extension may continue targeted limited-account refresh after the failure so accounts become eligible again when limits reset.
