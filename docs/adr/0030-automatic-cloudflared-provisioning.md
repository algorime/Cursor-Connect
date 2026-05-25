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
