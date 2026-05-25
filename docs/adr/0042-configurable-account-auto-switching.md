# Configurable Account Auto-Switching

Status: accepted

V1 should support user-configurable automatic switching between Codex Accounts when the Active Codex Account hits a relevant subscription limit or becomes temporarily unusable. This should live under Advanced controls because it can affect which account handles a request.

## Consequences

- Auto-switching should be off until the user configures it explicitly.
- When a user adds a second Codex Account, setup should strongly recommend the conservative hard-limits-only switch policy, but should not enable it silently.
- If a Codex Account Switch Policy arrives through synced metadata, it should remain pending until the referenced Codex Accounts exist and are authenticated locally.
- The dashboard should explain the selected Codex Account Switch Policy and which accounts are eligible.
- When multiple accounts are eligible, the next account should be selected by user-configured priority order, defaulting to the order accounts were added.
- Advanced users should be able to reorder accounts and mark accounts as manual-only so auto-switching skips them.
- The most important trigger is quota/limit state, such as a 5-hour or weekly window being exhausted or the upstream usage endpoint reporting requests are not allowed.
- Default automatic switching should happen only on hard limit evidence, such as `allowed=false`, `limit_reached=true`, an exhausted quota window, or a quota/limit error.
- Hard limit evidence should be classified through a structured signal taxonomy rather than raw status codes or untrusted strings alone.
- `used_percent >= 100` by itself should not trigger default switching unless paired with an explicit hard-limit signal such as `allowed=false`, `limit_reached=true`, or a non-null `rate_limit_reached_type`.
- Generic transient rate limits, provider outages, request-invalid errors, context/truncation failures, and stale quota state should not trigger default account switching.
- Transient rate limits may use a short same-account pre-output retry when retry-after is small, but they should not consume another Codex Account by default.
- Auth-invalid accounts should be skipped for future automatic selection when multi-account auto-switching is enabled, but auth failures are not quota events.
- Temporarily unusable accounts should not be skipped by default; users may enable an advanced policy to skip them when the signal is known before output starts.
- Advanced users may configure preemptive threshold policies, such as switching when a quota window exceeds a chosen percentage, but threshold switching should not be the default.
- The extension may also support manual account switching from the dashboard.
- Manual switching may select accounts marked `limited` or `temporarily unusable` only with an explicit warning and confirmation; accounts marked `auth required` must be repaired before they can become Active.
- Manual selection of a flagged account does not clear the flag; only a successful request, fresh quota, or auth/session repair should prove recovery.
- Proving recovery clears runtime state only; it must not silently change manual-only status, auto-switch eligibility, or priority order.
- Request handling should record which Codex Account served each request so Usage Statistics, errors, quota changes, and debugging remain attributable.
- Auto-switching must avoid hidden account use: users should be able to see when a switch happened, why it happened, and which account is now active.
- If a hard limit is returned before any assistant content or tool-call output has streamed to Cursor, the extension should switch to the next eligible account and retry the same request automatically.
- If output has already started streaming to Cursor, the extension should not switch accounts mid-stream; switch only for subsequent requests.
- If no eligible account is available, the local API should return a clear limit/auth error instead of silently retrying indefinitely.
- If all eligible accounts are blocked, the local API should fail fast with an OpenAI-compatible error instead of holding the Cursor request until a reset.
- Manual-only accounts should not be used automatically; if only manual-only accounts remain, require user action.
- Manual-only accounts should be excluded from blocked-account counts and shown as manually available unless they also have a real blocked state.
- Accounts marked `auth required` should not be used automatically until repaired, but should remain visible and under user control.
- Accounts marked `temporarily unusable` or `needs review` should remain visible with explanation and should require either user repair/review or an explicit advanced skip policy.
- Retry and switch behavior should be bounded to avoid loops, repeated failed requests, or accidental rapid quota consumption across accounts.
- Each original request should attempt each eligible Codex Account at most once, and manual-only accounts should never be consumed automatically.
- Pending synced policies, partially matched accounts, and unauthenticated accounts must never be treated as eligible automatic accounts.
- Dashboard/status should show why no account is eligible and the earliest known reset time when available.
- If no automatic account is eligible but manual-only accounts exist, dashboard/status should say no eligible automatic account is available and offer explicit manual switch actions.
- Removing a Codex Account should mark switch policies that reference it as pending/review; request handling must not silently reinterpret those policies around remaining accounts.
