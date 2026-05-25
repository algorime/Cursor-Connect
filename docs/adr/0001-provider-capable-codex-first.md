# Provider-Capable, Codex-First V1

Status: superseded by [0021 Codex Auth-First V1](0021-codex-auth-first-v1.md)

The new extension was originally planned as provider-capable from the beginning, with Codex as the only enabled and polished provider. This has been superseded: V1 is now Codex auth-first and should not display or scaffold non-Codex providers.

## Consequences

- This superseded direction allowed Coming-Soon Providers, but that is no longer active V1 guidance; ADR 0021 says the dashboard should not show non-Codex provider cards in V1.
- V1 should not expose half-finished Azure, Claude, MiniMax, generic OpenAI-compatible, or custom-provider behavior.
- The implementation should avoid Codex-only naming for genuinely provider-neutral infrastructure, but should not create provider abstractions that exist only for hypothetical future providers.
