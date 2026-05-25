# Safe Degradation And Explicit Repair For Platform Changes

Status: accepted

Cursor and Codex/ChatGPT behavior can change outside the extension's control: model routing, private OAuth parameters, quota schemas, OpenAI-key toggle internals, request shapes, and streaming event details may drift. V1 should degrade safely, show explicit repair guidance, and rely on extension updates or user-approved repair actions rather than silently patching around unknown changes.

## Consequences

- Do not silently download remote hotfix rules, routing tables, OAuth behavior changes, quota parsers, or Cursor-storage patches outside normal extension updates.
- Doctor should detect compatibility failures where possible and report safe statuses such as `model_routing_changed`, `oauth_unavailable`, `quota_unavailable`, `cursor_setup_repair_needed`, `openai_key_repair_unavailable`, or `protocol_shape_changed`.
- Dashboard should separate compatibility failures from user auth failures, quota exhaustion, local API failures, public URL failures, and upstream Codex failures.
- Diagnostic Harness Capture should be the explicit way to re-verify model routing and request shape when Cursor behavior changes.
- User-facing repair steps should be explicit: re-run setup check, update Cursor settings, disable/enable the Harness Routing Workaround, reauthenticate/import Codex auth, refresh quota, update extension, or run diagnostic capture.
- Durable fixes for changed protocol behavior, routing behavior, private OAuth behavior, quota parsing, packaged API behavior, or dashboard code should ship through normal extension updates.
- Temporary compatibility workarounds may exist only as user-visible switches or repair actions with safe warnings and clear status.
- Support reports should include safe compatibility status and extension version, but no raw tokens, generated local API keys, internal control secrets, raw prompts, raw provider payloads, raw account IDs, or emails.
