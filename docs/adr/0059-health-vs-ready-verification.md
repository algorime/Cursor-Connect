# Health Vs Ready Verification

Status: accepted

V1 should use a two-stage verification model for the Extension Base URL and local API: unauthenticated `/health` proves the route reaches the API process, while authenticated `/ready` proves the generated local API key works and the extension is actually usable.

## Consequences

- Tunnel and user-owned public URL liveness checks may call unauthenticated `/health`.
- `/health` should remain minimal and should not mark setup complete by itself.
- Setup verification should call authenticated `/ready` using the generated local API key.
- `/ready` should validate auth boundary, API readiness, auth-handoff readiness state, model readiness, and any other safe readiness facts needed for setup.
- The setup checklist should distinguish route reachable from ready to use.
- Doctor/check setup should report both stages separately so users can understand whether the failure is public routing, API process, API key, auth handoff, or deeper readiness.
- Cursor-facing setup should be considered complete only when authenticated readiness and required manual confirmations pass.
