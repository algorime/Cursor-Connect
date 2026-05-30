# Dashboard Assets Generated During Build

Status: accepted

The dashboard source of truth is the Svelte app under `apps/web/src`. Built dashboard files staged under the extension package are generated artifacts, not normal source files, because the root build and smoke flow must prove the extension can recreate packaged dashboard assets.

## Consequences

- `apps/web/src` and dashboard contracts are committed as source.
- `apps/web/dist` and `apps/extension/dashboard` are build/staging outputs and should stay ignored in normal development commits.
- Extension packaging must run the dashboard build/staging step before producing a runnable VSIX or smoke artifact.
- Smoke or packaging tests should verify the staged dashboard assets exist after build.
- If a future release process requires committing prebuilt dashboard assets, that should be documented as release-artifact policy rather than treated as source ownership.
