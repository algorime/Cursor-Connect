# Pre-Stream Retry On Account Limit

Status: accepted

When Codex Account auto-switching is enabled and the Active Codex Account returns a hard limit before any assistant content or tool-call output has been streamed to Cursor, V1 should switch to the next eligible Codex Account and retry the same request automatically. The goal is a continuous experience for the user and Cursor Agent.

V1 should not switch accounts mid-stream after assistant content, reasoning display content, or tool-call deltas have already been sent to Cursor.

## Consequences

- Pre-stream hard-limit failures should be retried on the next eligible Codex Account when the configured Codex Account Switch Policy allows it.
- A limit response before streaming starts should be treated as a switch opportunity, not as an immediate user-visible failure.
- The local API should supervise initial upstream Responses SSE events before flushing assistant-visible output so `response.failed`, `response.incomplete`, `error`, and early terminal failures can be classified before Cursor receives output.
- Once any assistant-visible output or tool-call delta has been sent to Cursor, do not replay the same request automatically on another account.
- Assistant-visible output includes text, reasoning display content, refusal/audio transcript/code-interpreter deltas, and tool-call argument deltas that are adapted into Cursor-visible chunks.
- If a hard limit appears after streaming has started, finish or fail that stream clearly, mark the Active Codex Account limited, and switch only for subsequent requests.
- Retry attempts must be bounded, such as at most one attempt per eligible account, to avoid loops.
- Transient rate-limit retries are separate from account switching: they may retry the same account once before output starts when retry-after is short, but should not switch accounts by default.
- Usage Statistics and switch history must record the original account limit event, the retry account, and the final serving account.
- Recovered pre-stream retries should appear as compact switch/retry events in the primary Usage Statistics timeline, with detailed failure classification available in drill-down/export.
- Account switch notices should not be injected into Cursor chat content; use dashboard/status/notifications instead.
- If no eligible account succeeds, return a clear limit/auth error to Cursor and show the account-limit state in the dashboard.
- Do not keep the Cursor request open waiting for a future reset after all eligible accounts fail or are skipped.
