# Cursor Configuration Automation Boundary

Status: accepted

The extension should automate every Cursor setup step that has a proven stable API or is owned by the extension itself. It should not silently edit Cursor's private storage to set Base URL, API key, Verify/Save state, or custom model IDs because no stable public mechanism was found.

The Ungate-style OpenAI-key enabled-state repair should be included as a recommended first-run setup option, but it should not be silently enabled by default. This is a narrow compatibility workaround for Cursor turning off the OpenAI API-key toggle; it is not permission to silently patch arbitrary Cursor model settings.

## Consequences

- V1 should include a guided checklist setup flow rather than pretending full Cursor model setup can be safely automated.
- The setup flow should copy exact values, open the closest available settings surface, show checklist state, support retry/skip/manual confirmation, and detect success when Cursor sends a request to the local API.
- Ungate's OpenAI-key enabled-state automation should be implemented as a first-run prompted, user-switchable workaround, guarded by runtime capability checks and clear labeling.
- Setup should recommend the repair when available, but the user must explicitly choose enable, skip, or decide later.
- If Cursor later exposes model/provider setup APIs, the extension should adopt them and remove manual steps.
- Private Cursor storage edits for Base URL/API key/custom model IDs are out of scope for V1 unless new evidence proves they are stable and reversible.
