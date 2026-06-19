import { resolveSource } from "../../core/source.js";
import { filterList, getBySlug, search, near, stats, todayIsoDate, type StatBy } from "../../core/query.js";
import { buildIcs } from "../../core/ics.js";
import { envelope, type DataSourceMode } from "../../core/envelope.js";
import { CliError, EXIT } from "../../core/errors.js";
import { renderEnvelope, deliver, type OutputOpts } from "../render.js";
import { capture } from "../../core/analytics.js";
import { str, num, bool, type ParsedArgs } from "../args.js";

export type Ctx = {
  args: ParsedArgs;
  output: OutputOpts;
  dataSource: DataSourceMode;
  telemetry: boolean;
};

const nowIso = (): string => new Date().toISOString();

async function emit<T extends Record<string, unknown>>(
  ctx: Ctx,
  command: string,
  results: T[],
  meta: { source: "live" | "local"; synced_at: string },
): Promise<number> {
  const env = envelope(results, { ...meta, data_source: ctx.dataSource });
  const text = renderEnvelope(env, ctx.output);
  await deliver(text, ctx.output.deliver);
  capture(ctx.telemetry, "cli_command", {
    command,
    surface: "cli",
    data_source: ctx.dataSource,
    source: meta.source,
    result_count: results.length,
  });
  if (results.length === 0) {
    capture(ctx.telemetry, "cli_zero_result", { command, filters: filterKeys(ctx.args) });
  }
  return EXIT.OK;
}

function filterKeys(p: ParsedArgs): string[] {
  return [...p.flags.keys()].filter(
    (k) => !["json", "compact", "csv", "agent", "select", "deliver", "data-source", "color", "yes", "input", "telemetry"].includes(k),
  );
}

export async function cmdList(ctx: Ctx): Promise<number> {
  const { source, synced_at, rows } = await resolveSource(ctx.dataSource, nowIso());
  const today = todayIsoDate(nowIso());
  const filtered = filterList(rows, {
    focus: str(ctx.args, "focus"),
    state: str(ctx.args, "state"),
    city: str(ctx.args, "city"),
    from: str(ctx.args, "from"),
    to: str(ctx.args, "to"),
    virtual: bool(ctx.args, "virtual"),
    hybrid: bool(ctx.args, "hybrid"),
    ceu: bool(ctx.args, "ceu"),
    memberOnly: bool(ctx.args, "member-only"),
    type: str(ctx.args, "type"),
    upcoming: bool(ctx.args, "upcoming"),
    sort: str(ctx.args, "sort"),
    limit: num(ctx.args, "limit"),
    offset: num(ctx.args, "offset"),
  }, today);
  return emit(ctx, "conferences list", filtered, { source, synced_at });
}

export async function cmdGet(ctx: Ctx): Promise<number> {
  const slug = ctx.args.positionals[0];
  if (!slug) throw new CliError("usage: conferences get <slug>", EXIT.USAGE);
  const { source, synced_at, rows } = await resolveSource(ctx.dataSource, nowIso());
  const found = getBySlug(rows, slug);
  if (!found) throw new CliError(`no conference with slug "${slug}"`, EXIT.NOT_FOUND);
  capture(ctx.telemetry, "conference_viewed", { slug, surface: "cli" });
  return emit(ctx, "conferences get", [found], { source, synced_at });
}

export async function cmdSearch(ctx: Ctx): Promise<number> {
  const query = ctx.args.positionals.join(" ").trim();
  if (!query) throw new CliError('usage: conferences search "<query>"', EXIT.USAGE);
  const { source, synced_at, rows } = await resolveSource(ctx.dataSource, nowIso());
  const hits = search(rows, query, num(ctx.args, "limit"));
  capture(ctx.telemetry, "cli_command", { command: "conferences search", query, result_count: hits.length, surface: "cli" });
  if (hits.length === 0) capture(ctx.telemetry, "cli_zero_result", { command: "conferences search", query });
  const env = envelope(hits, { source, synced_at, data_source: ctx.dataSource });
  await deliver(renderEnvelope(env, ctx.output), ctx.output.deliver);
  return EXIT.OK;
}

export async function cmdNear(ctx: Ctx): Promise<number> {
  const city = ctx.args.positionals[0];
  if (!city) throw new CliError("usage: conferences near <city>", EXIT.USAGE);
  const { source, synced_at, rows } = await resolveSource(ctx.dataSource, nowIso());
  const today = todayIsoDate(nowIso());
  const hits = near(rows, city, {
    state: str(ctx.args, "state"),
    upcoming: bool(ctx.args, "upcoming"),
    todayDate: today,
  });
  return emit(ctx, "conferences near", hits, { source, synced_at });
}

export async function cmdStats(ctx: Ctx): Promise<number> {
  const by = (str(ctx.args, "by") ?? "focus") as StatBy;
  if (!["focus", "state", "type", "month"].includes(by)) {
    throw new CliError("--by must be focus|state|type|month", EXIT.USAGE);
  }
  const { source, synced_at, rows } = await resolveSource(ctx.dataSource, nowIso());
  const agg = stats(rows, by);
  const env = envelope(agg, { source, synced_at, data_source: ctx.dataSource });
  await deliver(renderEnvelope(env as never, ctx.output), ctx.output.deliver);
  capture(ctx.telemetry, "cli_command", { command: "conferences stats", by, surface: "cli" });
  return EXIT.OK;
}

export async function cmdIcs(ctx: Ctx): Promise<number> {
  const { source, synced_at, rows } = await resolveSource(ctx.dataSource, nowIso());
  const all = bool(ctx.args, "all");
  let subset;
  if (all) {
    const today = todayIsoDate(nowIso());
    subset = rows.filter((c) => c.start_date && c.start_date >= today);
  } else {
    const slug = ctx.args.positionals[0];
    if (!slug) throw new CliError("usage: conferences ics <slug> | --all", EXIT.USAGE);
    const found = getBySlug(rows, slug);
    if (!found) throw new CliError(`no conference with slug "${slug}"`, EXIT.NOT_FOUND);
    subset = [found];
    capture(ctx.telemetry, "conference_viewed", { slug, surface: "cli", via: "ics" });
  }
  const ics = buildIcs(subset, synced_at);
  await deliver(ics, ctx.output.deliver);
  return EXIT.OK;
}
