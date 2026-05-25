# Cursor Configuration Automation Research

## Question

Can the extension stably automate Cursor setup for OpenAI-compatible custom providers, especially OpenAI API Base URL, API key, key-enabled state, and custom model IDs?

## Finding

No supported Cursor API was found for setting OpenAI API Base URL, API key, or custom model IDs from an extension.

Cursor's official API-key docs describe a manual flow:

1. Open `Cursor Settings > Models`
2. Find the provider
3. Paste API key
4. Click Verify
5. Click Save

Source: `https://cursor.com/help/models-and-usage/api-keys`

Cursor's official extension API currently exposes MCP server registration and plugin path registration under `vscode.cursor`; it does not expose model/provider configuration.

Source: `https://cursor.com/docs/extension-api`

VS Code has stable APIs to update registered settings, execute commands, inspect configuration, and use the clipboard. These are useful only if Cursor exposes a setting or command. No registered setting IDs were found for Cursor OpenAI Base URL, API key, or custom model IDs.

Source: `https://code.visualstudio.com/api/references/vscode-api`

## Stable Automation

These are safe to automate in V1:

- Auto-start the local API server and tunnel.
- Show the current Extension Base URL in the dashboard.
- Copy the Extension Base URL to clipboard.
- Copy the generated/local API key to clipboard.
- Copy recommended Cursor-Facing Model IDs to clipboard.
- Open generic VS Code/Cursor settings search using supported command APIs.
- Detect successful setup by observing requests hitting the local API.
- Validate local readiness through extension-owned health checks.

## Not Currently Automatable With Proven Stable APIs

These should remain guided/manual unless new evidence appears:

- Set Cursor's OpenAI API Base URL.
- Set Cursor's OpenAI API key.
- Click Cursor's Verify/Save buttons.
- Add Cursor custom model IDs.
- Deep-link directly to Cursor's Models settings page.

## Ungate Automation Checked

Ungate does not automate Base URL, API key, Verify/Save, or model ID setup. Its dashboard tells users to paste the URL and key manually.

Source: `.sources/ungate/apps/web/src/features/tunnel/TunnelPanel.svelte`

Ungate does automate one narrow behavior: keeping Cursor's OpenAI API Key toggle enabled. It does this by reading Cursor's private `state.vscdb` and executing a private command:

- Storage key: `src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser`
- JSON property: `useOpenAIKey`
- Command: `aiSettings.usingOpenAIKey.toggle`

Source: `.sources/ungate/apps/extension/src/openai-key-fix.ts`

This is private Cursor automation, not a supported public API. A Cursor forum thread reports `state.vscdb` can be inconsistent for selected-model/proxy state detection.

Source: `https://forum.cursor.com/t/developing-an-extension-to-automatically-toggle-openai-proxy-based-on-selected-model/92519`

## Classification

| Automation | Classification | V1 posture |
| --- | --- | --- |
| Copy Extension Base URL/API key/model IDs | Proven stable | Automate |
| Open settings/search command | Proven VS Code API | Automate as convenience |
| Setup success detection through local API traffic | Extension-owned | Automate |
| Register Cursor MCP/plugin paths | Proven Cursor API | Irrelevant to model setup |
| Toggle `useOpenAIKey` via `aiSettings.usingOpenAIKey.toggle` | Private/brittle | Optional explicit workaround only |
| Set Base URL/API key/model IDs directly | Not proven | Do not automate silently |

## Recommendation

V1 should implement a **Cursor Setup Assistant** experience: automate every supported step, copy exact values, open the closest settings surface, show a checklist, and detect completion automatically when Cursor sends traffic to the local API.

V1 should include an OpenAI-key toggle repair based on Ungate's approach. It should be first-run prompted rather than silently default-on, switchable by the user, labeled as a Cursor workaround, and guarded by runtime detection.

Setup should recommend the repair when available because it improves UX, but the user must explicitly choose enable, skip, or decide later after seeing that it relies on private Cursor behavior.

V1 should not silently edit Cursor's private storage to set Base URL, API key, or custom model IDs.
