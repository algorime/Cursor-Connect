# Multi-Account Codex Support

Status: accepted

V1 should support multiple Codex Accounts in one extension-host environment instead of only one signed-in account. This is part of the Codex Auth-First product: users may have more than one ChatGPT/Codex subscription identity and should be able to configure how the extension uses them.

## Consequences

- The auth model must store multiple Codex Accounts per extension-host environment.
- Each Codex Account needs separate secrets, non-secret account metadata, quota state, usage attribution, logout/switch controls, and error state.
- Each Codex Account should have a local user-editable label so multi-account UI can identify accounts without relying on email or raw account IDs.
- Non-secret account metadata and preferences may sync across extension-host environments, but auth secrets, runtime state, tunnel state, quota cache, and Usage Statistics remain per environment.
- Synced switch-policy preferences remain pending until matching Codex Accounts exist and are authenticated in the current extension-host environment.
- The dashboard should show a rich aggregate overview first while keeping account identity, account status, quota windows, and Usage Statistics available per account.
- Usage Statistics clear/export controls should support both all-account and per-account scope.
- Compact ambient surfaces such as the status bar should avoid exposing account identity by default; full identity belongs in dashboard/account management unless the user opts into short labels.
- There should be one Active Codex Account for a request, but the Active Codex Account may change through user action or configured switch policy.
- Account management should support auto-switch priority order and manual-only accounts for users who want an account available but never automatically selected.
- Adding a second Codex Account should prompt the user to choose whether to enable recommended hard-limits-only automatic switching, but automatic switching should remain off unless explicitly enabled.
- Account management should distinguish eligible, manual-only, limited, temporarily unusable, and auth-required accounts so automatic switching can skip accounts that cannot currently serve.
- Temporarily unusable accounts require clearer explanation than hard-limit states because they may indicate session challenges, permission problems, or broader outages rather than quota exhaustion.
- Manual account switching should allow explicit user override to limited or temporarily unusable accounts with warnings, but auth-required accounts must be repaired before selection.
- Successful real requests, fresh quota, or auth/session repair should clear stale account runtime states without changing user-configured manual-only, eligibility, or priority policy.
- Logout/disconnect should keep the Codex Account record as `auth required` with non-secret metadata and Usage Statistics intact; removing account data should be a separate confirmed action.
- Setup should still keep the first account path simple; additional accounts should be added through account management UI.
- Implementation should ship the single-account Codex happy path before multi-account manual switching, and should ship manual switching before hard-limit-only automatic switching.
- Multi-account support must not weaken the SecretStorage boundary: tokens remain per-account secrets and should not be logged, captured, or stored in plaintext.
- Cross-environment auth transfer remains Advanced-only even when multiple accounts exist.
