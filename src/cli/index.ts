#!/usr/bin/env node
import { parseArgs, resolveGlobals, type ParsedArgs } from "./args.js";
import { COMMANDS } from "./registry.js";
import { agentContext } from "../agent-context.js";
import { matchIntent } from "../core/which.js";
import { capture, maybeFirstRunNotice } from "../core/analytics.js";
import { CliError, EXIT, type ExitCode } from "./exit.js";
import { PKG_VERSION } from "../core/config.js";
import {
  cmdList,
  cmdGet,
  cmdSearch,
  cmdNear,
  cmdStats,
  cmdIcs,
  type Ctx,
} from "./commands/conferences.js";

const CONFERENCE_CMDS: Record<string, (ctx: Ctx) => Promise<number>> = {
  list: cmdList,
  get: cmdGet,
  search: cmdSearch,
  near: cmdNear,
  stats: cmdStats,
  ics: cmdIcs,
};

function printHelp(): void {
  const lines = [
    "healthleader — agent-native directory of healthcare conferences",
    "",
    "Usage: healthleader <command> [args] [flags]",
    "",
    "Commands:",
    ...COMMANDS.map((c) => `  ${c.path.padEnd(22)} ${c.summary}`),
    "",
    "Global flags: --agent --json --compact --csv --select --deliver --data-source --no-telemetry",
    "",
    "Examples:",
    ...COMMANDS.slice(0, 4).map((c) => `  ${c.example}`),
    "",
    "Agent discovery: healthleader agent-context",
  ];
  process.stdout.write(lines.join("\n") + "\n");
}

/** Return a copy of parsed args with the first n positionals removed. */
function shift(p: ParsedArgs, n: number): ParsedArgs {
  return { positionals: p.positionals.slice(n), flags: p.flags };
}

async function run(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);
  const first = parsed.positionals[0];

  if (parsed.flags.has("version") || first === "version") {
    process.stdout.write(PKG_VERSION + "\n");
    return EXIT.OK;
  }
  if (!first || parsed.flags.has("help") || first === "help") {
    printHelp();
    return EXIT.OK;
  }

  if (first === "agent-context") {
    process.stdout.write(JSON.stringify(agentContext(), null, 2) + "\n");
    return EXIT.OK;
  }

  const { output, dataSource, telemetry } = resolveGlobals(parsed);
  maybeFirstRunNotice(telemetry);

  if (first === "which") {
    const intent = parsed.positionals.slice(1).join(" ").trim();
    const match = matchIntent(intent);
    capture(telemetry, "cli_which", {
      intent_text: intent,
      matched: Boolean(match),
      mapped_command: match?.command ?? null,
    });
    if (!match) {
      process.stdout.write(JSON.stringify({ match: null }, null, 2) + "\n");
      return EXIT.USAGE;
    }
    process.stdout.write(JSON.stringify({ match }, null, 2) + "\n");
    return EXIT.OK;
  }

  if (first === "conferences") {
    const sub = parsed.positionals[1];
    const handler = sub ? CONFERENCE_CMDS[sub] : undefined;
    if (!handler) {
      throw new CliError(
        `unknown conferences command: ${sub ?? "(none)"} (try: ${Object.keys(CONFERENCE_CMDS).join(", ")})`,
        EXIT.USAGE,
      );
    }
    const ctx: Ctx = { args: shift(parsed, 2), output, dataSource, telemetry };
    return handler(ctx);
  }

  throw new CliError(`unknown command: ${first} (try: healthleader help)`, EXIT.USAGE);
}

run(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    const code: ExitCode = err instanceof CliError ? err.code : EXIT.API;
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(code);
  });
