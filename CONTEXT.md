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
The single Cursor-facing OpenAI-compatible URL a user pastes into Cursor for the extension, ending in `/v1`.
_Avoid_: Public route root, provider URL, proxy URL, tunnel URL

**Durable Extension Base URL**:
A stable user-owned **Extension Base URL** intended to keep working across extension restarts.
_Avoid_: Permanent URL, stable tunnel, production URL

**Public Route URL**:
A public HTTPS root that reaches the current extension-host API runtime before the **Extension Base URL** is derived.
_Avoid_: Extension Base URL, Base URL, tunnel URL

**Runtime Proof**:
A privacy-safe identifier returned by authenticated readiness to prove a **Public Route URL** reaches the current extension-host runtime.
_Avoid_: Server ID, process ID, machine ID

**Quick Tunnel**:
A temporary extension-started public route used for fast setup/testing when the user has not provided a **Durable Extension Base URL**.
_Avoid_: Permanent tunnel, managed Cloudflare setup, durable route

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

**OpenAI-Key Repair**:
A non-blocking **Cursor Configuration Automation** compatibility repair for Cursor's OpenAI API-key enabled state when the host capability is available.
_Avoid_: Required setup, general Cursor settings editor, guaranteed repair

**Usage Statistics**:
Local user-facing Codex request, token, cache, reasoning, error, latency, and limit information.
_Avoid_: Telemetry, analytics beacon, tracking

**Dashboard**:
The primary rich user surface for setup, status understanding, diagnostics, Usage Statistics, and settings.
_Avoid_: Wizard, sidebar, raw control dump

**Dashboard Home**:
The state-aware dashboard landing view that answers what the user should do or know right now.
_Avoid_: Permanent first-run page, static overview

**Ready Setup**:
The state where Cursor can use Codex through the verified Extension Base URL with required setup decisions made and verified Cursor traffic observed.
_Avoid_: Health-only, route-only, configured-ish

**Polished Dashboard Surface**:
A visible dashboard area that feels intentional, complete for its current scope, and understandable without developer context.
_Avoid_: Skeleton, placeholder page, raw action dump, polish later

**Dashboard Interaction Feedback**:
Immediate and persistent user feedback that confirms a dashboard interaction was received and shows whether any async work is pending, succeeded, or failed.
_Avoid_: Silent click, dead button, delayed-only notification

**Status Bar**:
The compact ambient Cursor surface for current Codex runtime/setup/limit state.
_Avoid_: Mini dashboard, account details surface

**Command Palette Recovery Action**:
A discoverable direct action for setup, inspection, copy, restart, and repair flows.
_Avoid_: Hidden shortcut, duplicate workflow

**Sidebar View**:
A future optional daily-monitoring surface with a distinct job from the Dashboard; not a V1 setup surface.
_Avoid_: Second dashboard, setup wizard panel

## Relationships

- A **Public Route URL** is verified before deriving an **Extension Base URL**.
- A **Public Route URL** verification is current only when its **Runtime Proof** matches the active extension-host runtime.
- An **Extension Base URL** receives requests for many **Cursor-Facing Model IDs**.
- A **Durable Extension Base URL** is the preferred stable form of **Extension Base URL** and is derived from a user-owned **Public Route URL**.
- A **Quick Tunnel** can provide a **Public Route URL** for a temporary **Extension Base URL**, but it is temporary and should not be described as durable.
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
- **OpenAI-Key Repair** is optional and capability-aware; unavailable repair capability must not be shown as an enabled working state and does not block **Ready Setup**.
- **Usage Statistics** are local product features for the user and are separate from external telemetry.
- The **Dashboard** is the primary rich surface; the **Status Bar** and **Command Palette Recovery Actions** are shortcuts and recovery surfaces.
- The **Dashboard Home** changes priority based on setup/runtime state instead of being a fixed first-run or fixed normal-mode page.
- **Ready Setup** requires local runtime readiness, Codex authentication, verified public readiness, a verified direct model path or non-blocking dormant compatibility state, manual Cursor setup confirmation, and observed Cursor-facing traffic.
- **Ready Setup** cannot rely on stale public readiness; the verified **Public Route URL** must have current **Runtime Proof**.
- Every visible dashboard area should be a **Polished Dashboard Surface**; future surfaces should stay hidden until they meet that bar.
- Every dashboard user intent should produce **Dashboard Interaction Feedback** immediately and keep visible feedback until pending async work succeeds or fails; setup-affecting actions should also prevent unsafe rapid conflicting actions while work is pending.
- A **Sidebar View** should not duplicate the **Dashboard**; if added later, it needs a distinct daily-monitoring role.

## Example Dialogue

> **Dev:** "Should users paste different URLs for different Codex model routes?"
> **Domain expert:** "No. Users paste one **Extension Base URL**. The selected **Cursor-Facing Model ID** determines the Codex routing behavior and **Upstream Model ID**."

> **Dev:** "Can we call every Cursor built-in model a native model?"
> **Domain expert:** "No. Use **Harness-Routed Model** only after a **Harness Capture** proves the request still reaches our extension."

## Flagged Ambiguities

- "Native model" was ambiguous between a Cursor built-in model, an upstream model, and a model that preserves Cursor's prompt/tool behavior; resolved term: **Harness-Routed Model**.
- "Model ID" was ambiguous between what Cursor sees and what Codex receives for V1; resolved terms: **Cursor-Facing Model ID** and **Upstream Model ID**.
- "Proxy URL" was ambiguous between the local server URL, tunnel URL, and user-facing Cursor configuration URL; resolved term for user configuration: **Extension Base URL**.
- "Public URL" was ambiguous between the public route root and the Cursor-facing `/v1` URL; resolved terms: **Public Route URL** for the root and **Extension Base URL** for the `/v1` Cursor value.
- "Ready public URL" was ambiguous between previously verified and verified for the active runtime; resolved: public readiness requires current **Runtime Proof**.
- "Manual routing" was ambiguous between a general user-editable model mapping system and a narrow workaround for a known Cursor limitation; resolved term for the narrow case: **Harness Routing Workaround**.
- "Model workaround required" was superseded after Cursor direct model routing was fixed; resolved: **Harness Routing Workaround** is dormant compatibility fallback and no longer blocks **Ready Setup** while direct model routing is verified.
- "Auto Cursor setup" was ambiguous between supported extension automation, guided setup, and private Cursor storage edits; resolved term: **Cursor Configuration Automation**.
- "OpenAI-key repair enabled" was ambiguous between a stored user preference and a working host capability; resolved: **OpenAI-Key Repair** is active only when capability is available.
- "Analytics" was ambiguous between local user-facing usage information and external telemetry; resolved term for the V1 feature: **Usage Statistics**.
- "Multi-account" was ambiguous between multiple providers, multiple API keys, and multiple ChatGPT/Codex subscriptions; resolved term: **Codex Account**.
- "Full sync" was ambiguous between safe preference sync and credential sharing; resolved distinction: **Syncable Account Metadata** can sync, auth tokens cannot in V1.
