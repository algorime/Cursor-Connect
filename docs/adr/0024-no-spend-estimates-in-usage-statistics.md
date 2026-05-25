# No Spend Estimates In Usage Statistics

Status: accepted

V1 Usage Statistics should not show approximate spend or per-token money estimates. For Codex Auth-First, the meaningful user limits are ChatGPT subscription limits such as the 5-hour and weekly windows, not per-request billing estimates.

## Consequences

- Do not display estimated cost, estimated spend, or pricing-rate configuration in V1 Usage Statistics.
- Prioritize ChatGPT subscription quota windows: used/remaining percentage, reset time, allowed/limited state, plan type, credits if the upstream usage endpoint reports them, and stale/error state.
- Prioritize debugging and efficiency metrics: request count, input tokens, cached input tokens, cache hit rate, output tokens, reasoning tokens, total tokens, latency, status/errors, Cursor-Facing Model ID, and Upstream Model ID.
- If future billing modes introduce real per-token costs, revisit this decision separately rather than adding misleading estimates now.
