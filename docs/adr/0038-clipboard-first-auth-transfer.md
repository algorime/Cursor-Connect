# Clipboard-First Auth Transfer

Status: accepted

One-time cross-environment Codex auth transfer should support both clipboard-based transfer and saved-file transfer. The default UX should be clipboard-first for simple local-to-remote flows, with an encrypted saved file as the fallback when clipboard transfer is awkward or unavailable.

## Consequences

- Clipboard transfer should be the primary path because it is faster for common local-to-remote setup flows.
- Saved-file transfer should be available as a fallback and should use a passphrase-protected or one-time-code-protected encrypted payload rather than plaintext token material.
- The UI must warn that transfer payloads contain Codex auth material that can grant account access in the target environment.
- Transfer payloads should be short-lived where practical and should include source environment, target environment, account identity when available, and creation time.
- The import flow should validate payload shape, explain what account/environment will be imported, and require explicit confirmation before writing secrets.
- The export flow should encourage clearing clipboard contents or deleting transfer files after use.
- Clipboard transfer may stay optimized for immediate short-lived transfer without a passphrase by default, but saved-file import must require the matching passphrase/code before writing secrets.
- Transfer payloads are only for one-time import/export; they must not become a continuous sync channel.
- This feature should be exposed from Advanced auth controls, not normal onboarding.
