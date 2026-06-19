import { COMMANDS } from "./cli/registry.js";
import { PKG_VERSION } from "./core/config.js";

/** Versioned, machine-readable description of the CLI for agents. */
export function agentContext(): unknown {
  return {
    schema_version: "1",
    cli: {
      name: "healthleader",
      description:
        "Agent-native directory of healthcare conferences (Medicare, Medicaid, payer, quality). Read-only.",
      version: PKG_VERSION,
    },
    auth: { mode: "none", note: "Public data; no API key required." },
    annotations: { "mcp:read-only": "true" },
    global_flags: [
      { name: "agent", usage: "Expands to --json --compact --no-input --no-color --yes." },
      { name: "json", usage: "Force JSON (default when piped)." },
      { name: "compact", usage: "Single-line JSON." },
      { name: "csv", usage: "CSV output." },
      { name: "select", usage: "Comma-separated field paths." },
      { name: "deliver", usage: "stdout | file:<path> | webhook:<url>." },
      { name: "data-source", usage: "auto | live | local." },
      { name: "no-telemetry", usage: "Disable anonymous usage analytics." },
    ],
    envelope: {
      meta: ["source", "synced_at", "count", "version", "data_source"],
      results: "array of conference records (public fields only)",
    },
    exit_codes: { "0": "ok", "2": "usage", "3": "not_found", "4": "auth", "5": "api", "7": "rate_limited", "10": "config" },
    commands: COMMANDS.map((c) => ({
      name: c.path,
      summary: c.summary,
      args: c.args ?? null,
      annotations: { "mcp:read-only": "true" },
      flags: c.flags.map((f) => ({ name: f.name, type: f.type, usage: f.usage })),
      example: c.example,
    })),
  };
}
