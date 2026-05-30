# Built-In OpenAI Model Setup Only

Status: accepted, qualified by ADR-0122

V1 should guide users to use Cursor's built-in OpenAI model list with the extension's OpenAI-compatible setup. It should not expose a user-facing `custom` model fallback or ask users to add arbitrary custom model IDs.

## Consequences

- The Cursor Setup Assistant should focus on Cursor's OpenAI API-key/Base URL flow and built-in OpenAI-family model choices.
- `custom` may remain useful for internal diagnostics or future harness probes, but it should not appear as a recommended or supported V1 user setup path.
- ADR-0122 supersedes the older Phase 3 workaround-first recommendation: while direct routing is verified, the recommended V1 path is direct Cursor-facing `gpt-5.5`.
- The supported model list may include supported built-in OpenAI-family Cursor models, but the GPT-5.4-to-GPT-5.5 Harness Routing Workaround is now an advanced dormant fallback, not the normal setup path.
- If fresh Harness Capture or equivalent release evidence shows direct `gpt-5.5` no longer reaches the Extension Base URL correctly, the setup recommendation must move back behind explicit diagnostic/workaround guidance rather than silently rewriting models.
- This preserves Cursor's richer OpenAI-family agent harness instead of falling back to the weaker generic custom-model harness captured during the probe.
