# Auth Separate By Default, Configurable Sharing

Status: accepted

Codex auth should be separate per extension-host environment by default. Local Cursor, Remote SSH, dev containers, WSL, and similar environments may have different SecretStorage boundaries and security expectations, so V1 should not silently copy Codex tokens between them.

Users should be able to intentionally configure auth sharing/import between environments, but only through explicit UI with warnings and explanations.

Non-secret metadata and preferences may sync separately from auth to improve UX, but synced metadata does not authenticate an account in the target environment.

## Consequences

- Default behavior: each extension-host environment signs in or imports Codex auth independently.
- Non-secret labels and preferences should sync automatically across environments when platform sync is enabled and available.
- Do not silently copy OAuth refresh tokens, access tokens, ID tokens, or imported Codex CLI token material between local and remote environments.
- Dashboard should explain which environment owns the current auth state before sign-in, import, logout, or sharing actions.
- Configurable sharing/import must require explicit user action and should warn that Codex tokens grant account access in the target environment.
- Sharing/import should use one-time explicit transfer/import flows over continuous hidden syncing in V1.
- The dashboard must explain that the target environment owns its own auth state and refresh lifecycle after import.
- Logout should make clear whether it affects only the current environment or any explicitly shared/imported auth state.
- Implementation must preserve the extension-owned refresh authority and avoid concurrent refresh races if auth material is intentionally reused across environments.
