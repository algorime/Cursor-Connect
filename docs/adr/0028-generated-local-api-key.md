# Generated Local API Key

Status: accepted

The extension should generate its own random local API key for Cursor setup instead of asking the user to invent or type one. Cursor needs a key-shaped value for the OpenAI-compatible provider configuration, but this key is extension-owned local authentication, not the user's Codex identity.

## Consequences

- Generate the local API key automatically during setup or first API start.
- Store the local API key in VS Code/Cursor `SecretStorage` because Cursor sends it as an authorization credential to the Extension Base URL.
- Dashboard should provide copy and regenerate controls.
- Regenerating the key should clearly warn that Cursor setup must be updated with the new key.
- The local API key should not rotate automatically on a schedule; rotation is explicit user action or warning-gated suspicious-exposure remediation.
- The local API should reject requests with missing or mismatched local API keys.
- Only minimal `/health` liveness may be unauthenticated; readiness, models, chat completions, and internal status require the generated local API key or extension-private channel.
- The local API key remains required even when requests arrive through a managed tunnel or user-owned public URL.
- The local API key should be high entropy and must not be logged, exported, synced, or reused as the extension-to-API internal control secret.
- Failed local API key auth should not reveal account state, model lists, quota state, local paths, tunnel details, or setup diagnostics.
- Do not reuse Codex OAuth tokens, ChatGPT access tokens, or imported Codex CLI tokens as the Cursor-facing local API key.
