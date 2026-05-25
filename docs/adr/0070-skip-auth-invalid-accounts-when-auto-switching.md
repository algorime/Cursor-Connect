# Skip Auth-Invalid Accounts When Auto-Switching

Status: accepted

When multi-account auto-switching is enabled, V1 should automatically skip Codex Accounts that are known auth-invalid for future requests. Auth-invalid accounts cannot serve requests until the user signs in again, so keeping them in the automatic eligible set would create avoidable failures.

## Consequences

- Auth-invalid signals include failed refresh with `refresh_token_expired`, `refresh_token_reused`, `refresh_token_invalidated`, missing required token material, or repeated upstream `401` after one forced same-account refresh.
- Auth-invalid accounts should be marked `auth required` and removed from automatic eligibility until the user reauthenticates or explicitly repairs the account.
- This skip behavior should apply only when the user has enabled multi-account auto-switching; otherwise the active account should fail clearly with an auth-required state.
- Auth-invalid state is not quota exhaustion and should not be recorded as a quota/limit switch reason.
- The extension should not silently delete, logout, or remove the account. The user keeps control over reauth, logout, removal, and account priority.
- Dashboard/status/notifications should surface the auth-required state according to notification preferences.
- Usage Statistics and switch history should record safe auth category/code, refresh-attempt state, skipped account, selected fallback account if any, and final serving account.
