# Failed Requests In Usage Statistics

Status: accepted

V1 Usage Statistics should include failed requests as first-class local records, without storing prompt bodies or raw provider payloads. Failures are important for understanding quota limits, auth problems, upstream instability, account switching, and Cursor setup issues.

## Consequences

- Failed request records should include timestamp, Codex Account, Cursor-Facing Model ID, Upstream Model ID if resolved, route/request shape, latency, HTTP status when available, error category, safe error code, finish state, and whether stream output had already started.
- Failed request records should include retry and Codex Account switch information when relevant, including original account, retry account, final serving account, and switch reason.
- Token usage should be stored for failed requests only when the upstream response provides safe usage data.
- Failed request records should not include prompt bodies, tool schemas, raw provider responses, OAuth tokens, local API keys, or raw headers.
- Dashboard aggregate views should include recent failure rate and error categories, while details remain drill-down/export material.
- Failed requests should participate in auto-pruning, global/per-account clear, and hashed-ID export policies.
- Account-limit failures should be visible in both Usage Statistics and account switch history.
- If per-account Usage Statistics are deleted later, retained switch/failure history involving that account should be anonymized as `Removed account` and stripped of account-specific identifiers and quota details.
- Failed pre-stream attempts that are automatically retried and ultimately succeed should appear as compact recovered retry/switch events in the primary Usage Statistics timeline, with detailed error classification in drill-down/export.
- Transient same-account retries should record retry-after, attempt count, recovery status, and safe error category/code.
- Requests that fail because no eligible Codex Account is available should record attempted/skipped accounts, blocking reasons, earliest known reset when available, and no serving account.
- Manual-only accounts skipped by auto-switching should be recorded as skipped by policy rather than blocked.
