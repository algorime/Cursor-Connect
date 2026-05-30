# Ready Setup Definition

Status: accepted

The dashboard and status bar should present setup as ready only when Cursor can use Codex through the verified Extension Base URL and the required user decisions have been made. Ready requires local API readiness, Codex authentication, public route `/health` plus authenticated `/ready` with current runtime proof, a verified direct model path or non-blocking dormant workaround state, manual Cursor setup confirmation, and observed Cursor-facing traffic after that setup.

## Consequences

- Public route health alone is not ready.
- Authenticated public readiness alone is not ready until Cursor setup is confirmed and traffic is observed.
- Leaving the dormant Harness Routing Workaround undecided does not prevent ready while direct model routing is verified.
- Quick Tunnel can be ready, but it should carry a temporary-route warning rather than being described as durable.
- OpenAI-key repair, notification preference changes, status bar preference changes, and future Usage/Accounts/Logs pages do not block ready.
- Usage storage degradation should warn but not block request proxy readiness unless storage failure later becomes a hard product requirement.
