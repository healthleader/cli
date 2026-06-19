/** Single source of truth for the command surface. Drives help + agent-context. */

export type FlagSpec = {
  name: string;
  type: "string" | "boolean" | "number";
  usage: string;
};

export type CommandSpec = {
  /** Full invocation path, e.g. "conferences list". */
  path: string;
  summary: string;
  args?: string; // positional hint, e.g. "<slug>"
  flags: FlagSpec[];
  readOnly: true;
  example: string;
};

const OUTPUT_FLAGS: FlagSpec[] = [
  { name: "json", type: "boolean", usage: "Force JSON output (default when piped)." },
  { name: "compact", type: "boolean", usage: "Single-line JSON." },
  { name: "csv", type: "boolean", usage: "CSV output." },
  { name: "select", type: "string", usage: "Comma-separated field paths (dotted for jsonb)." },
  { name: "deliver", type: "string", usage: "stdout | file:<path> | webhook:<url>." },
  { name: "data-source", type: "string", usage: "auto | live | local." },
];

const LIST_FILTERS: FlagSpec[] = [
  { name: "focus", type: "string", usage: "Focus area or theme (e.g. Medicare)." },
  { name: "state", type: "string", usage: "Two-letter state (e.g. TX)." },
  { name: "city", type: "string", usage: "City substring." },
  { name: "from", type: "string", usage: "Start date >= YYYY-MM-DD." },
  { name: "to", type: "string", usage: "Start date <= YYYY-MM-DD." },
  { name: "virtual", type: "boolean", usage: "Virtual events only." },
  { name: "hybrid", type: "boolean", usage: "Hybrid events only." },
  { name: "ceu", type: "boolean", usage: "CEU/CME-offering events only." },
  { name: "member-only", type: "boolean", usage: "Member-only events only." },
  { name: "type", type: "string", usage: "conference|summit|forum|expo|webinar." },
  { name: "upcoming", type: "boolean", usage: "Only events starting today or later." },
  { name: "sort", type: "string", usage: "Sort field (default start_date)." },
  { name: "limit", type: "number", usage: "Max rows." },
  { name: "offset", type: "number", usage: "Pagination offset." },
];

export const COMMANDS: CommandSpec[] = [
  {
    path: "conferences list",
    summary: "List healthcare conferences with filters.",
    flags: [...LIST_FILTERS, ...OUTPUT_FLAGS],
    readOnly: true,
    example: 'healthleader conferences list --upcoming --focus "Medicare" --agent',
  },
  {
    path: "conferences get",
    summary: "Get one conference by slug (full public record).",
    args: "<slug>",
    flags: [...OUTPUT_FLAGS],
    readOnly: true,
    example: "healthleader conferences get rise-national-2026",
  },
  {
    path: "conferences search",
    summary: "Relevance search over name, host, description, and themes.",
    args: '"<query>"',
    flags: [{ name: "limit", type: "number", usage: "Max rows." }, ...OUTPUT_FLAGS],
    readOnly: true,
    example: 'healthleader conferences search "risk adjustment" --limit 5',
  },
  {
    path: "conferences near",
    summary: "Conferences in/near a city (by city or nearest airport).",
    args: "<city>",
    flags: [
      { name: "state", type: "string", usage: "Constrain to a state." },
      { name: "upcoming", type: "boolean", usage: "Only upcoming." },
      ...OUTPUT_FLAGS,
    ],
    readOnly: true,
    example: "healthleader conferences near Orlando --upcoming",
  },
  {
    path: "conferences ics",
    summary: "Export a conference (or all upcoming) as an iCalendar (.ics) feed.",
    args: "<slug>",
    flags: [
      { name: "all", type: "boolean", usage: "All upcoming conferences." },
      { name: "deliver", type: "string", usage: "stdout | file:<path>." },
      { name: "data-source", type: "string", usage: "auto | live | local." },
    ],
    readOnly: true,
    example: "healthleader conferences ics rise-national-2026 --deliver file:rise.ics",
  },
  {
    path: "conferences stats",
    summary: "Aggregate counts across the live directory.",
    flags: [
      { name: "by", type: "string", usage: "focus | state | type | month." },
      ...OUTPUT_FLAGS,
    ],
    readOnly: true,
    example: "healthleader conferences stats --by focus",
  },
  {
    path: "which",
    summary: "Map a natural-language intent to a command (exit 0 match / 2 no-match).",
    args: '"<intent>"',
    flags: [],
    readOnly: true,
    example: 'healthleader which "behavioral health conferences in texas"',
  },
  {
    path: "agent-context",
    summary: "Machine-readable description of all commands, flags, and auth.",
    flags: [],
    readOnly: true,
    example: "healthleader agent-context",
  },
];
