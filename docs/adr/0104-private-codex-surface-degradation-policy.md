# Private Codex Surface Degradation Policy

Status: accepted

V1 relies on some Codex/ChatGPT surfaces that are not stable public product APIs, including built-in ChatGPT/Codex OAuth parameters, Codex CLI client/originator semantics, account id claims, and the quota/limit endpoint used for Usage Statistics. These integrations should be treated as useful but failure-prone surfaces with explicit degradation behavior.

The proxy should degrade in layers instead of turning every private-surface failure into total product failure.

## Consequences

- If quota/limit lookup breaks, normal Codex request proxying should continue when auth and upstream requests still work.
- Broken quota lookup should show quota unavailable/stale with safe error detail in dashboard/status/doctor, not block chat completions.
- If built-in OAuth breaks, setup should offer explicit `~/.codex/auth.json` import for users who have or can create Codex CLI auth.
- Codex CLI auth import remains user-initiated and warning-gated; it should not become silent fallback.
- If built-in OAuth and Codex CLI import are both unavailable, setup should show auth unavailable and must not mark setup complete.
- If account id claims or required upstream account headers cannot be derived, the affected Codex Account should be marked auth/setup incomplete rather than guessed from email or display identity.
- Private-surface failures should be classified separately from user auth failures, quota exhaustion, local API failures, and Cursor setup failures.
- Doctor/support reports should include safe private-surface status such as `oauth_unavailable`, `quota_unavailable`, or `account_id_missing`, without raw tokens, raw provider payloads, or sensitive account identity.
- Usage Statistics should record quota unavailable/stale states as local metadata, but should not store raw quota responses.
- Dashboard copy should clearly say quota/limit status is best-effort/unofficial if implemented through private ChatGPT usage signals.
- Future replacement with stable public APIs should preserve the same product boundaries: built-in auth first, explicit import fallback, request proxy independent from quota dashboard when possible.
- Unknown private-surface changes should degrade to explicit repair/status guidance rather than silent downloaded behavior patches. Durable fixes ship through extension updates.
- See also `0114-safe-degradation-and-explicit-repair-for-platform-changes.md`.
