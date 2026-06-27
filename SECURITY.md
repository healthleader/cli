# Security Policy

## Reporting a vulnerability

This project serves public, read-only conference data and ships no credentials.
If you find a security issue (for example, a way to read non-public data, or a
flaw in the CLI's `--deliver` guards), please report it privately:

- Open a [GitHub security advisory](https://github.com/healthleader/cli/security/advisories/new), or
- Email **security@healthleader.ai**

Please do not open a public issue for sensitive reports. We aim to acknowledge
within 72 hours.

## Scope & design notes

- The CLI and MCP server are **read-only**. There are no write operations.
- Output is restricted to a public field allowlist (`src/core/fields.ts`); the
  data source itself is a public, RLS-gated view exposing only live rows and
  non-internal columns.
- `--deliver file:` is confined to the working directory; `--deliver webhook:`
  requires https and blocks private/loopback/metadata hosts.
- Telemetry is anonymous and opt-out (`--no-telemetry`, `DO_NOT_TRACK=1`).
