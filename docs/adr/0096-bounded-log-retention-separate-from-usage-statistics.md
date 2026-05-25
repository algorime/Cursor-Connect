# Bounded Log Retention Separate From Usage Statistics

Status: accepted

Extension and local API logs should have a short, bounded retention policy that is separate from Usage Statistics retention. Logs are operational diagnostics and are more likely than structured Usage Statistics to contain accidental sensitive context, so V1 should keep only rolling recent logs by default.

## Consequences

- Log retention should be time-bounded and/or size-bounded independently from Usage Statistics retention.
- Default retention should keep recent rolling logs only, rather than indefinite logs.
- Logs should remain operational diagnostics, not a long-term activity history.
- Normal logs should be structured safe event logs and should not contain raw request/response payloads.
- Usage Statistics retention, pruning, clear/export, and aggregation remain governed by Usage Statistics decisions and should not be shortened just because logs are short-lived.
- Dashboard should expose clear/export controls for logs separately from Usage Statistics clear/export controls.
- Support bundle inclusion of logs remains opt-in even when logs exist locally.
- Log export should use the same redaction posture as support bundles: no OAuth tokens, refresh tokens, generated local API keys, raw prompts, raw provider payloads, raw account IDs, emails, tunnel credentials, or unredacted Cursor correlation IDs by default.
- Doctor should report log-retention status and warn if logs grow beyond the expected bounded policy.
