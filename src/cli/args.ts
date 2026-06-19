import type { OutputOpts } from "./render.js";
import type { DataSourceMode } from "../core/envelope.js";
import { CliError, EXIT } from "../core/errors.js";

/** Flags that consume the next token as a value (everything else is boolean). */
const VALUE_FLAGS = new Set([
  "select",
  "deliver",
  "data-source",
  "limit",
  "offset",
  "focus",
  "state",
  "city",
  "from",
  "to",
  "type",
  "sort",
  "by",
  "radius-hint",
]);

export type ParsedArgs = {
  positionals: string[];
  flags: Map<string, string | boolean>;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!;
    if (!tok.startsWith("--")) {
      positionals.push(tok);
      continue;
    }
    let name = tok.slice(2);
    let inlineVal: string | undefined;
    const eq = name.indexOf("=");
    if (eq !== -1) {
      inlineVal = name.slice(eq + 1);
      name = name.slice(0, eq);
    }
    if (name.startsWith("no-")) {
      flags.set(name.slice(3), false);
      continue;
    }
    if (VALUE_FLAGS.has(name)) {
      const val = inlineVal ?? argv[++i];
      if (val == null) throw new CliError(`flag --${name} requires a value`, EXIT.USAGE);
      flags.set(name, val);
    } else {
      flags.set(name, inlineVal ?? true);
    }
  }
  return { positionals, flags };
}

export function str(p: ParsedArgs, name: string): string | undefined {
  const v = p.flags.get(name);
  return typeof v === "string" ? v : undefined;
}

export function bool(p: ParsedArgs, name: string): boolean {
  return p.flags.get(name) === true;
}

export function num(p: ParsedArgs, name: string): number | undefined {
  const v = str(p, name);
  if (v == null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new CliError(`flag --${name} must be a number`, EXIT.USAGE);
  return n;
}

/** Apply the `--agent` expansion in place, then derive output + data-source opts. */
export function resolveGlobals(p: ParsedArgs): {
  output: OutputOpts;
  dataSource: DataSourceMode;
  agent: boolean;
  telemetry: boolean;
} {
  const agent = bool(p, "agent");
  if (agent) {
    // --agent === --json --compact --no-input --no-color --yes
    if (!p.flags.has("json")) p.flags.set("json", true);
    if (!p.flags.has("compact")) p.flags.set("compact", true);
    if (!p.flags.has("color")) p.flags.set("color", false);
    if (!p.flags.has("input")) p.flags.set("input", false);
    if (!p.flags.has("yes")) p.flags.set("yes", true);
  }

  const ds = (str(p, "data-source") ?? "auto") as DataSourceMode;
  if (!["auto", "live", "local"].includes(ds)) {
    throw new CliError(`--data-source must be auto|live|local`, EXIT.USAGE);
  }

  const select = str(p, "select")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const noColor = p.flags.get("color") === false || process.env.NO_COLOR != null;
  const telemetry =
    p.flags.get("telemetry") !== false &&
    process.env.DO_NOT_TRACK !== "1" &&
    process.env.HEALTHLEADER_TELEMETRY !== "0";

  return {
    output: {
      json: bool(p, "json"),
      compact: bool(p, "compact"),
      csv: bool(p, "csv"),
      select,
      deliver: str(p, "deliver"),
      color: !noColor,
      isTty: Boolean(process.stdout.isTTY),
    },
    dataSource: ds,
    agent,
    telemetry,
  };
}
