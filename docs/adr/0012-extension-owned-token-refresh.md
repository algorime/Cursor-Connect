# Extension-Owned Token Refresh

Status: accepted

V1 should make the extension host the owner of Codex token refresh. The local API process should request a valid access token from the extension when needed rather than reading, storing, or refreshing long-lived OAuth credentials independently.

## Consequences

- The extension host is the authority for `SecretStorage` reads/writes, refresh-token use, logout, and account metadata updates.
- Token refresh should be serialized per Codex Account across Cursor windows within the shared runtime boundary so concurrent windows or API requests do not race, reuse old refresh tokens, or overwrite newer credentials.
- The local API should receive only the access token and account metadata needed for the current upstream request.
- The local API should request that token/account context over the extension-owned private control channel and should time out clearly if the extension cannot provide it.
- The API process should not persist access tokens, refresh tokens, imported Codex CLI token material, or ID tokens in its own database or state files.
- After a one-time cross-environment auth import, the target extension host owns refresh for its imported auth state; V1 should not continuously sync token rotations between environments.
- Multi-account refresh and auto-switching must keep account ownership explicit: refreshing one account must not overwrite another account's secrets.
- Refresh-token failure for one Codex Account should mark only that account `auth required`; it should not delete the account, affect other accounts, or be classified as quota exhaustion.
- If the API process starts before auth is ready, it should expose a clear not-authenticated readiness state instead of trying to self-authenticate.
- API readiness should depend on the private control channel being established, even if no Codex Account is currently authenticated.
- This preserves the current proxy's reliability goals while aligning with V1's `SecretStorage` boundary.
