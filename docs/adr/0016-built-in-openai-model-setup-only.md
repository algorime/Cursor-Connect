# Built-In OpenAI Model Setup Only

Status: accepted

V1 should guide users to use Cursor's built-in OpenAI model list with the extension's OpenAI-compatible setup. It should not expose a user-facing `custom` model fallback or ask users to add arbitrary custom model IDs.

## Consequences

- The Cursor Setup Assistant should focus on Cursor's OpenAI API-key/Base URL flow and built-in OpenAI-family model choices.
- `custom` may remain useful for internal diagnostics or future harness probes, but it should not appear as a recommended or supported V1 user setup path.
- Direct `gpt-5.5` selection should not be presented as a working V1 path unless a future Harness Capture proves it reaches the Extension Base URL.
- The supported model list may include supported built-in OpenAI-family Cursor models, but the recommended V1 path should be `gpt-5.4` with the opt-in Harness Routing Workaround to send the request upstream as `gpt-5.5`.
- The recommendation should explain that upstream `gpt-5.5` is still preferred for quality even if the preserved Cursor harness is not a perfect 1:1 GPT-5.5 harness.
- This preserves Cursor's richer OpenAI-family agent harness instead of falling back to the weaker generic custom-model harness captured during the probe.
