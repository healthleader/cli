---
name: healthleader-conferences
description: >-
  Query the HealthLeader.ai directory of healthcare conferences (Medicare,
  Medicaid, payer, quality, digital health). Use when a user asks what
  healthcare/health-plan conferences exist, are upcoming, are in a city or
  state, offer CEU/CME credit, or wants one added to their calendar.
argument-hint: "<command> [args] | install"
allowed-tools: "Read Bash"
---

# HealthLeader Conferences — agent guide

A read-only, agent-native directory of healthcare conferences. No API key required.

## Install the CLI (once)

```bash
npx -y @healthleader/cli --version
```

Or wire it in as MCP tools:

```bash
claude mcp add healthleader -- npx -y @healthleader/cli mcp
```

## Discover the surface

Always start here — it returns a versioned JSON description of every command, flag, and exit code:

```bash
npx -y @healthleader/cli agent-context
```

## Common queries (add `--agent` for compact JSON)

```bash
# Upcoming Medicare conferences
npx -y @healthleader/cli conferences list --upcoming --focus "Medicare" --agent

# Conferences in Texas offering CEU credit
npx -y @healthleader/cli conferences list --state TX --ceu --agent

# One conference, full record
npx -y @healthleader/cli conferences get rise-west-2026 --agent

# Free-text search
npx -y @healthleader/cli conferences search "risk adjustment" --limit 5 --agent

# Near a city
npx -y @healthleader/cli conferences near Orlando --upcoming --agent

# Add to calendar
npx -y @healthleader/cli conferences ics rise-west-2026 --deliver file:rise.ics

# What's in the directory
npx -y @healthleader/cli conferences stats --by focus --agent

# Map a natural-language intent to a command (exit 0 match / 2 no-match)
npx -y @healthleader/cli which "behavioral health conferences in texas"
```

## Output contract

Every command returns `{ meta: { source, synced_at, count, version, data_source }, results: [...] }`.
Read `.results` for data; `.meta.source` is `live` or `local`. Project fields with
`--select slug,name,start_date`. Exit codes: `0` ok, `2` usage, `3` not found, `5` api error.

## Notes
- All commands are read-only. There are no write operations.
- Only published events and public fields are served (no internal/contact data).
- Found a missing conference? Tell the user to open an issue at the repo — that feedback
  is the most useful contribution.
