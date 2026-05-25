# Manual Local API Key Rotation

Status: accepted

V1 should not rotate the generated local API key on a schedule. Rotation should happen only when the user explicitly regenerates it, or when the extension/doctor detects suspicious exposure and prompts the user to rotate.

Scheduled rotation would silently break Cursor's configured API key and harm the setup UX.

## Consequences

- No automatic time-based rotation for the generated local API key.
- Dashboard should provide an explicit regenerate action with a clear warning that Cursor setup must be updated afterward.
- Doctor/check setup may recommend rotation if it detects risky exposure, such as non-loopback bind, suspicious repeated auth failures, or a user-reported leak.
- Suspicious-state rotation should still require explicit user confirmation before changing the key.
- After rotation, setup guidance should immediately show copy/update steps for Cursor.
- Old keys should stop working after successful rotation.
- Rotation events should be recorded in local operational history without storing the old or new key value in logs.
