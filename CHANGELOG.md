# Changelog

## 0.1.1

- **Upcoming by default**: `conferences list` and the MCP `list_conferences`
  tool now return upcoming events by default (by end date, so in-progress
  multi-day events stay). Use `--include-past` for the full archive; an explicit
  `--from`/`--to` range also includes past events.
- **Pagination metadata**: list responses include `meta.total`, `offset`,
  `limit`, `has_more`, and a `coverage_window` (`total_live`, `upcoming_count`,
  `next_event_date`).
- **New public fields**: `conference_series_id` (recurring series) and
  `updated_at` (freshness).
- **Official MCP registry**: added `server.json` and CI publishing.
- **Security**: the CLI now reads a public view (`conferences_public`) that
  excludes internal columns; `--deliver` webhook/file guards; `--select`/`--sort`
  validated against the public allowlist.
- Test suite (34 tests) and CI on Node 20/22.

## 0.1.0

- Initial release: `list`, `get`, `search`, `near`, `ics`, `stats`,
  `agent-context`, `which`; MCP server with six read-only tools; offline
  snapshot; Printing-Press-conformant agent surface.
