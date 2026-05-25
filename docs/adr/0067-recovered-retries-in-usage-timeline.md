# Recovered Retries In Usage Timeline

Status: accepted

When a pre-stream Codex Account limit causes an automatic retry that eventually succeeds on another Codex Account, V1 should show a compact retry/switch event in the primary Usage Statistics timeline instead of hiding it only inside request details.

## Consequences

- A recovered pre-stream retry should not look like a failed user request when the final request succeeded.
- The primary timeline should show a compact event with source account, target account, switch reason, and whether it was a pre-stream retry.
- Detailed error payload classification should stay in expanded details/export so normal users are not alarmed by recovered failures.
- Switch events should explain why the Active Codex Account changed and which account ultimately served the request.
- Timeline events should follow the same privacy/export rules as Usage Statistics: no prompt bodies, raw provider payloads, OAuth tokens, local API keys, or sensitive account identifiers by default.
