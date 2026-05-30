# Dashboard Interaction Feedback And Setup Operation Locking

Status: accepted

Dashboard interactions must acknowledge user intent immediately and keep visible feedback until pending async work succeeds or fails. Setup-affecting operations are mutually exclusive: while one setup operation is pending, other setup-affecting actions and setup-copy actions are disabled so users cannot race setup state or copy stale Cursor configuration. The dashboard should not queue setup actions; a conflicting attempt during a pending setup operation is rejected with visible feedback. Navigation and read-only inspection remain usable.

## Consequences

- Every dashboard click or selection should produce visible feedback within the current event loop / next render, not only after the extension host responds.
- Long-running actions should show local pending state on the initiating control and a global activity strip describing the current operation.
- Success feedback should remain visible briefly; errors should remain visible until dismissed or replaced.
- Setup-critical actions should use operation-specific pending, success, error, and next-step copy; smaller copy/preference actions may use operation-specific pending/success/error without next-step guidance.
- Initial dashboard loading should show explicit progress, escalate after a short wait, and present recovery guidance if setup state does not arrive; the dashboard should not appear empty.
- Important disabled actions should explain why they are disabled with visible helper text for primary setup controls and tooltip-equivalent text for minor controls.
- Setup-affecting operations include Quick Tunnel start/stop/restart, public URL verification, Cursor setup confirmation, Harness Routing Workaround decisions, OpenAI-key repair decisions, status/notification preferences that affect setup/status behavior, and local API key rotation.
- While a setup-affecting operation is pending, other setup-affecting actions and copy setup/base URL/API key/model actions are disabled to avoid stale values or unsafe rapid state changes.
- Copy actions are read-sensitive rather than setup-affecting: a copy action may show its own pending/success state, but it does not create a setup operation lock.
- Dashboard navigation remains available during pending operations; disabled future surfaces remain disabled.
- Dashboard pending state should be request-bound: completions and errors clear the matching requestId rather than blindly clearing unrelated pending UI.
- Long pending operations should escalate visually: show a “still working” message after a short delay, then a stuck-operation recovery path after a longer delay without automatically unlocking or queuing duplicate setup mutations.
- Recovery from a stuck pending operation should prefer safe inspection or refresh actions, such as refreshing setup state, reloading the dashboard, running non-mutating doctor checks when safe, or restarting runtime; the dashboard should not launch another setup mutation while one is still considered pending.
- The web dashboard may implement this initially with requestId-based local pending state without adding a formal extension-owned action lifecycle protocol.
- A shared action lifecycle protocol can be added later if true progress events become necessary, but silent async action gaps are not acceptable in the visible dashboard.
