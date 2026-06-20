# @healthleader/cli

**The agent-native directory of healthcare conferences.** Medicare, Medicaid, payer, and quality events — curated, verified, and queryable by AI agents and humans alike.

Ask Claude "which Medicare conferences are coming up this fall?" and get a real answer from a maintained source — not a web-scraped guess.

```bash
npx @healthleader/cli conferences list --upcoming --focus "Medicare"
```

No API key. No signup. The data is public; the code is MIT.

---

## Install

Zero-install via `npx` (recommended for agents):

```bash
npx -y @healthleader/cli conferences list --agent
```

Or install globally:

```bash
npm install -g @healthleader/cli
healthleader --help
```

## Use it as an MCP tool (Claude, etc.)

```bash
claude mcp add healthleader -- npx -y @healthleader/cli mcp
```

Then just ask in plain English. The server exposes six read-only tools:
`list_conferences`, `get_conference`, `search_conferences`, `conferences_near`,
`conference_ics`, `directory_stats`.

## Commands

| Command | What it does |
|---|---|
| `conferences list` | Filter by `--focus --state --city --from --to --virtual --ceu --upcoming --type` |
| `conferences get <slug>` | Full public record for one conference |
| `conferences search "<q>"` | Relevance search over name, host, description, themes |
| `conferences near <city>` | Conferences in/near a city (city or nearest airport) |
| `conferences ics <slug>` | iCalendar (`.ics`) export (`--all` for all upcoming) |
| `conferences stats --by focus` | Aggregate counts (`focus`/`state`/`type`/`month`) |
| `which "<intent>"` | Map a natural-language intent to a command |
| `agent-context` | Machine-readable description of every command + flag |

## Agent mode

Add `--agent` to any command. It expands to `--json --compact --no-input --no-color --yes`:

```bash
npx @healthleader/cli conferences list --upcoming --focus "Behavioral Health" --agent
```

Every command returns the same envelope:

```json
{ "meta": { "source": "live", "synced_at": "…", "count": 12, "version": "0.1.0", "data_source": "auto" },
  "results": [ { "slug": "…", "name": "…", "start_date": "…", … } ] }
```

Other output controls: `--json`, `--compact`, `--csv`, `--select slug,name,ceu_info.credits`,
`--deliver file:out.json` / `--deliver webhook:https://…`, `--data-source auto|live|local`.

**Exit codes:** `0` ok · `2` usage · `3` not found · `4` auth · `5` api · `7` rate-limited · `10` config.

## Offline

The package ships a snapshot of the directory. `--data-source local` reads it with no network;
`--data-source auto` (default) uses live data and falls back to the snapshot if offline.

## Privacy

Anonymous usage stats help us fill gaps in the directory: which filters/tools are used, and
**search terms that return zero results** (so we know what to add). Successful search text is
*not* logged. No personal data; a random per-install id only. Opt out with `--no-telemetry`,
`DO_NOT_TRACK=1`, or `HEALTHLEADER_TELEMETRY=0`.

## Data

Sourced from the [HealthLeader.ai](https://healthleader-ai.vercel.app) conference directory.
Only published (`status=live`) events and public fields are ever served. To suggest a missing
conference or a correction, open an issue.

## License

MIT © HealthLeader.ai
