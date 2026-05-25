# Normalize Quota Responses, Discard Raw

Status: accepted

V1 should normalize Codex quota/limit responses from the unofficial `wham/usage` endpoint and discard the raw upstream payload by default. Store only the fields the product displays or uses, plus limited schema/debug metadata.

The endpoint is private and unstable, and raw payloads may contain unexpected account, subscription, or limit details that the extension does not need to persist.

## Consequences

- Store normalized quota fields such as plan type, allowed/limited state, quota windows, used/remaining percentage, reset times, credits status when useful, last refresh time, stale/error state, and account attribution.
- Store lightweight schema/debug metadata such as parser version, source endpoint version if available, unknown-field count, and parse warnings.
- Do not store the full raw `wham/usage` response in the normal Usage Statistics database.
- Do not log full quota responses by default.
- Raw quota payload capture, if ever needed, belongs behind explicit diagnostic raw capture with warnings and redaction, not normal usage stats.
- Unknown or changed schemas should degrade to stale/error/partial quota state rather than breaking proxy requests.
- Exports should include normalized quota state and parse warnings, not raw upstream payloads by default.
