# Structured Safe Normal Logs

Status: accepted

Normal extension and local API logs should be structured event logs with safe fields only. Raw request or response payloads should never appear in normal logs; they belong only in explicit diagnostic recording mode.

## Consequences

- Normal logs should record structured events such as component, event type, severity, timestamp, route, status, latency, safe error category/code, and recovery action.
- Public endpoint protection events may include safe categories such as auth failure, body too large, timeout, rate limited, or control channel disconnected.
- Account references in logs should use local Codex Account Labels or privacy-safe hashes only when needed for diagnosis.
- Normal logs must not include raw request bodies, raw response bodies, prompt text, tool schemas, OAuth tokens, refresh tokens, generated local API keys, raw account IDs, emails, or provider payloads.
- Raw request/response payload capture remains governed by diagnostic recording mode and requires explicit user action.
- Support bundle log export should use these structured logs and still apply redaction and bounded retention rules.
- This is a guardrail, not a large export feature area; detailed export behavior should stay behind the existing doctor/support decisions.
