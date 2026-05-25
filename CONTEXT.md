# Cursor Extension Context

This context describes the product language for a Cursor extension that exposes Codex/ChatGPT subscription access through a Cursor-compatible interface.

## Language

**Provider**:
A historical planning term for non-Codex upstream integrations. Not active V1 product language.
_Avoid in V1_: Backend, vendor, route, provider marketplace

**Codex-First**:
Superseded product posture where Codex was the first polished integration while product language remained provider-capable.
_Use instead for V1_: Codex Auth-First

**Codex Auth-First**:
The V1 product posture where Codex authentication, setup, routing, and usage statistics are the whole product scope.
_Avoid_: Multi-provider MVP, provider marketplace

**Codex Account**:
A ChatGPT/Codex subscription identity the extension can authenticate, route requests through, and report usage for.
_Avoid_: Provider account, OpenAI key

**Active Codex Account**:
The Codex Account currently selected to serve new Cursor requests in an extension-host environment.
_Avoid_: Default token, current provider

**Codex Account Switch Policy**:
User-configurable rules that decide when the extension may switch the Active Codex Account, especially when quota limits are reached.
_Avoid_: Load balancing, account pool hack

**Codex Account Label**:
A local user-visible alias for a Codex Account that helps distinguish accounts without exposing sensitive account identity.
_Avoid_: Email, account ID, provider account name

**Syncable Account Metadata**:
Non-secret account-adjacent labels and preferences that may follow the user across extension-host environments without granting account access.
_Avoid_: Token sync, shared auth state, cloud account

**Extension Base URL**:
The single OpenAI-compatible URL a user pastes into Cursor for the extension.
_Avoid_: Provider URL, proxy URL, tunnel URL

**Cursor-Facing Model ID**:
The model identifier Cursor sees and uses when preparing a request.
_Avoid_: Public model, selected model

**Upstream Model ID**:
The model identifier sent from the extension to Codex/ChatGPT for V1.
_Avoid_: Real model, target model

**Harness-Routed Model**:
A Cursor built-in model ID that preserves Cursor's model-specific behavior while still reaching the Extension Base URL.
_Avoid_: Native model, built-in model

**Harness Capture**:
A controlled recording of the exact request Cursor emits for a selected model.
_Avoid_: Traffic dump, request log

**Harness Routing Workaround**:
A user-visible opt-in that maps one Harness-Routed Model to a different Upstream Model ID to preserve Cursor's harness despite a known Cursor routing limitation.
_Avoid_: Manual routing, fake model, Azure-style rewrite

**Cursor Configuration Automation**:
Extension behavior that configures, opens, repairs, or guides Cursor's own model/API-key settings.
_Avoid_: Cursor setup hack, hidden settings patch

**Usage Statistics**:
Local user-facing Codex request, token, cache, reasoning, error, latency, and limit information.
_Avoid_: Telemetry, analytics beacon, tracking

## Relationships

- An **Extension Base URL** receives requests for many **Cursor-Facing Model IDs**.
- In V1, a **Cursor-Facing Model ID** resolves through Codex model routing to one **Upstream Model ID**.
- A **Harness-Routed Model** is a special kind of **Cursor-Facing Model ID**.
- **Codex Auth-First** supersedes **Codex-First** for V1: Codex authentication and usage are the product scope, not a multi-provider launch.
- A **Codex Auth-First** environment may contain multiple **Codex Accounts**, but exactly one is the **Active Codex Account** for a given request.
- A **Codex Account Label** names a **Codex Account** locally for dashboard, status, notifications, and Usage Statistics surfaces.
- A **Codex Account Switch Policy** can change the **Active Codex Account** only when the user has configured it.
- **Syncable Account Metadata** may describe a **Codex Account** across environments, but it never authenticates the account or grants access; matching should use privacy-safe fingerprints derived from stable opaque account IDs rather than raw account identity or email.
- A **Harness Capture** evaluates whether a **Cursor-Facing Model ID** is a **Harness-Routed Model**.
- A **Harness Routing Workaround** exists only for a known routing limitation, not as a general model-routing interface.
- **Cursor Configuration Automation** is separate from extension-owned setup; it concerns Cursor's own settings surface.
- **Usage Statistics** are local product features for the user and are separate from external telemetry.

## Example Dialogue

> **Dev:** "Should users paste different URLs for different Codex model routes?"
> **Domain expert:** "No. Users paste one **Extension Base URL**. The selected **Cursor-Facing Model ID** determines the Codex routing behavior and **Upstream Model ID**."

> **Dev:** "Can we call every Cursor built-in model a native model?"
> **Domain expert:** "No. Use **Harness-Routed Model** only after a **Harness Capture** proves the request still reaches our extension."

## Flagged Ambiguities

- "Native model" was ambiguous between a Cursor built-in model, an upstream model, and a model that preserves Cursor's prompt/tool behavior; resolved term: **Harness-Routed Model**.
- "Model ID" was ambiguous between what Cursor sees and what Codex receives for V1; resolved terms: **Cursor-Facing Model ID** and **Upstream Model ID**.
- "Proxy URL" was ambiguous between the local server URL, tunnel URL, and user-facing Cursor configuration URL; resolved term for user configuration: **Extension Base URL**.
- "Manual routing" was ambiguous between a general user-editable model mapping system and a narrow workaround for a known Cursor limitation; resolved term for the narrow case: **Harness Routing Workaround**.
- "Auto Cursor setup" was ambiguous between supported extension automation, guided setup, and private Cursor storage edits; resolved term: **Cursor Configuration Automation**.
- "Analytics" was ambiguous between local user-facing usage information and external telemetry; resolved term for the V1 feature: **Usage Statistics**.
- "Multi-account" was ambiguous between multiple providers, multiple API keys, and multiple ChatGPT/Codex subscriptions; resolved term: **Codex Account**.
- "Full sync" was ambiguous between safe preference sync and credential sharing; resolved distinction: **Syncable Account Metadata** can sync, auth tokens cannot in V1.
