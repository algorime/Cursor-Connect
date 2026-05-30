# Always-Visible Status Bar With Limits

Status: accepted

V1 should include an always-visible, compact status bar item by default. It should make Codex runtime state and useful limit/quota status feel integrated into Cursor without requiring the user to open the extension dashboard.

The status bar item is the primary supported integrated surface for this in VS Code/Cursor: it can show text/icons, expose a tooltip, and run a command such as opening the dashboard. Rich charts and detailed history still belong in the dashboard.

## Consequences

- The status bar item should be on by default and configurable by the user.
- The compact text should show high-signal state such as `Codex: Ready`, `Codex: Setup`, `Codex: Limited`, `Codex: Error`, or a compact limit indicator when quota data is available.
- During setup, the compact text should prefer the most actionable auth/route state, such as `Codex: Auth needed`, `Codex: Tunnel needed`, `Codex: Route stale`, `Codex: Setup blocked`, or `Codex: Ready`.
- When useful and not too noisy, the status bar may show approximate quota window state such as remaining percentage, limited state, stale quota data, or Active Codex Account state.
- Hover tooltip should provide richer details: Active Codex Account, quota windows, last quota refresh/stale state, tunnel/API/auth state, and last switch event when relevant.
- The status bar is ambient, not a mini dashboard; detailed auth, Public Route URL, Quick Tunnel, `/health`, `/ready`, and Runtime Proof information belongs in the tooltip and dashboard rather than in long status text.
- When all eligible accounts are blocked, the status bar should show a compact limited/error state and tooltip should include earliest known reset time and blocked account categories when safe.
- If only manual-only accounts are available, the tooltip should distinguish them from blocked accounts and point the user to manual switch controls.
- Clicking the item should open the dashboard to the relevant state-aware view.
- The status bar is the ambient integrated surface for V1; do not add a separate sidebar view unless a future decision gives it a distinct job.
- Users should be able to choose whether the status bar shows compact runtime state only, runtime plus limits, or hides the item.
- The status bar must not expose secrets, raw prompts, OAuth tokens, local API keys, or sensitive account identifiers unless the user explicitly chooses a more verbose display.
- The compact status bar should be privacy-first: no Codex Account email/name by default, with optional user-defined short labels for users who opt in.
- Detailed charts, account cards, switch history, setup controls, and logs remain in the dashboard.
