# Separate Local API Process

Status: accepted

V1 should run the OpenAI-compatible local API as a separate Node/Fastify process in `apps/api`, spawned and supervised by the extension in `apps/extension`, rather than embedding the HTTP server directly inside the VS Code/Cursor extension host process.

## Consequences

- `apps/api` remains independently testable for request adaptation, streaming adaptation, auth handoff behavior, health checks, and provider routing.
- A proxy crash or blocking upstream call should not directly crash or block the extension host UI path.
- The extension owns process lifecycle: start, readiness detection, restart, logs, shutdown, and stale-process recovery.
- The API owns protocol behavior: `/v1/models`, `/v1/chat/completions`, provider adapters, stream mapping, upstream error adaptation, and Usage Statistics database writes/queries.
- The API exposes narrow health/readiness/status endpoints for supervision, but the full doctor/check setup report belongs to the extension host.
- Only minimal liveness health should be public; readiness, models, chat completions, and internal status should require the generated local API key or extension-private channel.
- The API should bind to `127.0.0.1` by default; public reachability should come through the tunnel or user-owned public URL path.
- The extension should choose and persist a random high local API port per extension-host runtime so durable user-owned public URL forwarding does not need repair after every restart.
- If the persisted port is unavailable, the extension should enter a repair-required state rather than silently changing the API port.
- The extension must provide a private auth handoff/control path because the API process should not independently read or persist long-lived OAuth secrets.
- The private control channel should be established by the extension when it spawns/supervises the API process, and should be distinct from the public OpenAI-compatible HTTP surface.
- The initial private control transport should be loopback internal endpoints guarded by an extension-generated internal control secret passed at process spawn.
- V1 should ship `apps/api` as bundled JavaScript and avoid bundling a separate full Node runtime unless packaging tests prove it is required.
- The first build milestone should be a tracer-bullet packaging proof that validates spawning, supervision, health/readiness, persisted port behavior, and internal control authentication before richer product features.
- This mirrors the VS Code extension architecture pattern of keeping heavier long-running work outside the extension host, similar to how language servers run separately from the extension client.
