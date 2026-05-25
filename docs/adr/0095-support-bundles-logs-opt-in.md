# Support Bundles Logs Opt In

Status: accepted

Doctor/support export bundles should include structured doctor data and Usage Statistics summaries by default. Extension/API logs should be optional and separately selectable because logs are more likely to contain accidental sensitive context.

## Consequences

- Default support bundles should include the redacted doctor report, setup/runtime health, account states, quota status, recent safe error summaries, switch-event summaries, and anonymized Usage Statistics highlights.
- Extension and local API logs should not be included by default.
- If the user includes logs, the UI should make that choice explicit and explain that logs can contain accidental sensitive context.
- Included logs should be redacted, time/window limited, and preferably recent-only rather than entire historical log files.
- Logs should have their own bounded retention policy separate from Usage Statistics retention.
- Normal logs should be structured safe event logs; raw request/response payloads belong only in explicit diagnostic recording mode.
- Log inclusion should not enable diagnostic raw capture or include raw request/response bodies.
- Logs must redact OAuth tokens, generated local API keys, raw prompts, raw provider payloads, raw account IDs, emails, tunnel credentials, and unredacted Cursor correlation IDs by default.
- JSON remains the canonical support bundle format; optional Markdown summaries should be generated from the same redacted structured data and selected log excerpts.
- Doctor UI should offer logs as a separate checkbox or follow-up action, not as part of the default export path.
