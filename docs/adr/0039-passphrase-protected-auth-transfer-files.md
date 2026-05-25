# Passphrase Protected Auth Transfer Files

Status: accepted

Saved-file Codex auth transfers should be passphrase-protected or protected by a one-time code. Clipboard auth transfer remains optimized for immediate short-lived transfer and should not require a passphrase by default.

Auth transfer is optional and dangerous because the payload can grant access to the user's Codex/ChatGPT account in another environment. The saved-file path is more likely to persist on disk, be copied, or be forgotten, so it needs stronger protection than clipboard transfer.

## Consequences

- Saved-file export should encrypt the transfer payload with a user-provided passphrase or generated one-time code shown during export.
- Saved-file import should require the matching passphrase/code before parsing or writing secrets to `SecretStorage`.
- Clipboard transfer may remain unencrypted by default for immediate use, but must show clear warnings and should encourage clearing clipboard contents after import.
- Both transfer modes should require explicit confirmation before importing secrets into the target environment.
- Transfer payloads must include enough metadata to explain source environment, target environment intent, account identity when available, creation time, and expiration/staleness warnings.
- Do not build continuous auth sync on top of transfer payload encryption; this remains a one-time optional import/export feature.
