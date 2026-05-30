# Auth And Route Command Center

Status: accepted

Phase 3 dashboard readiness depends primarily on two facts: whether Codex auth is usable and whether Cursor can reach the current extension-host runtime through the public route. The dashboard should make these facts more visible than secondary preferences or dormant compatibility workarounds.

## Consequences

- Home and Setup should show a prominent setup command center focused on Codex Auth and Public Route state.
- The Codex Auth card should show signed-in, missing, expired, import-available, or unknown states with direct actions such as sign in, import Codex CLI auth, and recheck.
- The Codex Auth card must remain privacy-first and should not expose raw account identity, OAuth tokens, or local secrets.
- The Public Route card should distinguish no route, Quick Tunnel starting/running/stopped, durable route configured, `/health` reachable, authenticated `/ready`, stale or mismatched Runtime Proof, and temporary versus durable route.
- The Public Route card should show the Public Route URL root separately from the Cursor-facing Extension Base URL ending in `/v1`.
- Copy actions for the Extension Base URL should stay blocked until public route verification and Runtime Proof freshness pass.
- Dormant model-routing compatibility information should appear below auth/route status and must not dominate the first-run flow while direct model routing is verified.
- Preferences, OpenAI-key repair, and future Usage/Accounts/Logs surfaces should not visually compete with auth and route setup until the user reaches Ready Setup.
