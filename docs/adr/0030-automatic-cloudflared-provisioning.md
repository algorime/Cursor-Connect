# Automatic Cloudflared Provisioning

Status: accepted

V1 should provision `cloudflared` automatically for the built-in Cloudflare Quick Tunnel path instead of requiring users to install it manually. This preserves a useful fast-start option and follows the useful Ungate pattern where the extension handles the tunnel binary as part of setup.

## Consequences

- Prefer a packaged `cloudflared` binary when extension packaging and platform constraints allow it.
- If packaging the binary is not practical for a platform, download it into extension-owned storage during setup.
- Downloaded binaries should use platform/architecture detection and integrity checks before execution.
- Downloaded binaries should not be silently auto-updated after first provisioning; updates should normally arrive through extension updates or explicit repair/update controls.
- The dashboard should show tunnel installation/provisioning status and actionable errors.
- Users should not need to install `cloudflared`, create a Cloudflare account, or provide Cloudflare configuration when choosing the temporary Quick Tunnel path.
- Durable user-owned public URL remains the preferred stable path for users who can provide one, and does not require the extension to run or provision `cloudflared`.

## Implementation supply-chain decision for Phase 3

Phase 3 uses an extension-owned pinned-download path first rather than bundling platform binaries in the initial package. The pinned version is `cloudflared` `2026.5.1`, published 2026-05-25 in the upstream `cloudflare/cloudflared` GitHub release. Integrity is checked against GitHub release asset digest values before execution.

Pinned assets:

- Linux x64: `cloudflared-linux-amd64`, SHA-256 `3c6a5ba995a258dbe90f98e5fdb2c2620b7be72c3ca761614f6eb52aee252cea`
- Linux arm64: `cloudflared-linux-arm64`, SHA-256 `7b7a8b9a2764acab0fecda633cb54a6c0df42d7f8ca1ec45c78333c2227d8d91`
- macOS x64: `cloudflared-darwin-amd64.tgz`, SHA-256 `1389ce2cff3ec7ee777d7bed43253e433aa2521b9b00cc42ccf0066a4d971149`
- macOS arm64: `cloudflared-darwin-arm64.tgz`, SHA-256 `af75f2fa11a42de1ceaa0345537c51d3c86915748e65bc2c6680983dfd36ae74`
- Windows x64: `cloudflared-windows-amd64.exe`, SHA-256 `8b97b5af442651e07c52caa9c79c6f60032bc10b675c2b36dd11c7690d9942e3`

The binary is cached under extension-owned global storage. There is no silent auto-update; update or repair is an explicit setup action or a future extension release. Unsupported platform/architecture and checksum mismatch are explicit provisioning failures.
