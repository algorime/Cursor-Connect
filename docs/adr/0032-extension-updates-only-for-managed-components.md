# Extension Updates Only For Managed Components

Status: accepted

V1 should update extension-managed components through normal extension updates, not through silent runtime auto-updaters. The local API bundle, dashboard assets, model/routing behavior, and packaged `cloudflared` version should change when the extension version changes.

## Consequences

- Do not implement a background updater that silently replaces the local API bundle, dashboard code, model-routing rules, Codex adapter behavior, or packaged `cloudflared` independently of the extension version.
- If `cloudflared` cannot be packaged for a platform, the extension may download it during first-time provisioning, but should not silently keep replacing it with newer versions afterward.
- Provide explicit repair/update controls for downloaded `cloudflared` if needed, with visible status and errors.
- Treat normal extension updates as the trust and debugging boundary for protocol behavior changes.
- Compatibility fixes for Cursor model routing, Codex request/response adaptation, private OAuth behavior, quota parsing, dashboard code, local API behavior, or packaged component behavior should ship through extension updates rather than silent remote hotfixes.
- User-visible repair controls may guide setup or toggle known workarounds, but should not hide unknown behavior changes behind downloaded rules.
- If future security needs require out-of-band component updates, make a separate decision with signing/integrity, user visibility, rollback, and diagnostics requirements.
- See also `0114-safe-degradation-and-explicit-repair-for-platform-changes.md`.
