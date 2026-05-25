# Static Model List Plus Routing Verification

Status: accepted

V1 should ship a conservative static list of supported built-in OpenAI-family Cursor-Facing Model IDs, and should also include a developer/diagnostic Harness Capture mode that can verify Cursor routing behavior for the installed Cursor version.

## Consequences

- Normal users get a stable setup flow based on known supported models instead of being asked to run probes.
- The shipped model list should be conservative and based on captured behavior or strong compatibility evidence.
- Diagnostic routing verification should be available for maintainers, advanced users, and support cases when Cursor changes routing behavior.
- Verification mode should capture whether a selected Cursor-Facing Model ID reaches the Extension Base URL and what request shape it emits.
- Future releases can promote models such as direct `gpt-5.5` only after verification proves they are Harness-Routed.
- If direct built-in `gpt-5.5` becomes Harness-Routed, the setup recommendation should migrate to direct `gpt-5.5` rather than keep the `gpt-5.4` workaround as permanent product behavior.
- If a previously supported Cursor-Facing Model ID no longer reaches the Extension Base URL or emits an unexpected shape, V1 should mark it as routing changed / not verified and guide the user to diagnostic Harness Capture or an extension update rather than silently falling back to `custom`.
- Harness Capture must keep the same safety rules: synthetic prompts only, credential/header redaction, no production conversation capture, and clear local storage location.
