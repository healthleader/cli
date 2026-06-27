import { resolveSource } from "../../core/source.js";
import {
  filterList,
  getBySlug,
  search,
  near,
  stats,
  isUpcoming,
  coverageWindow,
  todayIsoDate,
  type StatBy,
} from "../../core/query.js";
import { buildIcs } from "../../core/ics.js";
import { envelope, type DataSourceMode, type EnvelopeOpts } from "../../core/envelope.js";
import { CliError, EXIT } from "../../core/errors.js";
import { renderEnvelope, deliver, contentTypeFor, type OutputOpts } from "../render.js";
import { PUBLIC_FIELDS } from "../../core/fields.js";
import { capture } from "../../core/analytics.js";
import { str, num, bool, type ParsedArgs } from "../args.js";

export type Ctx = {
  args: ParsedArgs;
  output: OutputOpts;
  dataSource: DataSourceMode;
  telemetry: boolean;
};

const nowIso = (): string => new Date().toISOString();

type EmitOpts = {
  extra?: Partial<Pick<EnvelopeOpts, "total" | "offset" | "limit" | "coverage_window">>;
  props?: Record<string, unknown>; // extra telemetry props (filter values)
};

async function emit<T extends Record<string, unknown>>(
  ctx: Ctx,
  command: string,
  results: T[],
  meta: { source: "live" | "local"; synced_at: string },
  opts: EmitOpts = {},
): Promise<number> {
  const env = envelope(results, {
    source: meta.source,
    synced_at: meta.synced_at,
    data_source: ctx.dataSource,
    ...opts.extra,
  });
  const text = renderEnvelope(env, ctx.output);
  await deliver(text, ctx.output.deliver, contentTypeFor(ctx.output));
  capture(ctx.telemetry, "cli_command", {
    command,
    surface: "cli",
    data_source: ctx.dataSource,
    source: meta.source,
    result_count: results.length,
    ...opts.props,
  });
  if (results.length === 0) {
    capture(ctx.telemetry, "cli_zero_result", { command, ...opts.props });
  }
  return EXIT.OK;
}

export async function cmdList(ctx: Ctx): Promise<number> {
  const { source, synced_at, rows } = await resolveSource(ctx.dataSource, nowIso());
  const today = todayIsoDate(nowIso());
  const sort = str(ctx.args, "sort");
  if (sort && !(PUBLIC_FIELDS as readonly string[]).includes(sort)) {
    throw new CliError(`--sort: "${sort}" is not a sortable field`, EXIT.USAGE);
  }
  const params = {
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
    // upcoming is the DEFAULT; --include-past opts back into the archive.
    includePast: bool(ctx.args, "include-past"),
    sort,
    limit: num(ctx.args, "limit"),
    offset: num(ctx.args, "offset"),
  };
  const { rows: results, total } = filterList(rows, params, today);
  return emit(ctx, "conferences list", results, { source, synced_at }, {
    extra: {
      total,
      offset: params.offset,
      limit: params.limit,
      coverage_window: coverageWindow(rows, today),
    },
    props: {
      focus: params.focus ?? null,
      state: params.state ?? null,
      city: params.city ?? null,
      type: params.type ?? null,
      virtual: params.virtual || undefined,
      ceu: params.ceu || undefined,
      include_past: params.includePast || undefined,
    },
  });
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
  // Don't log the raw query on success (healthcare-sensitive). Capture the
  // query text ONLY when it returns nothing — that miss is the gap-loop signal.
  capture(ctx.telemetry, "cli_command", { command: "conferences search", result_count: hits.length, surface: "cli" });
  if (hits.length === 0) capture(ctx.telemetry, "cli_zero_result", { command: "conferences search", query });
  const env = envelope(hits, { source, synced_at, data_source: ctx.dataSource });
  await deliver(renderEnvelope(env, ctx.output), ctx.output.deliver, contentTypeFor(ctx.output));
  return EXIT.OK;
}

export async function cmdNear(ctx: Ctx): Promise<number> {
  const city = ctx.args.positionals[0];
  if (!city) throw new CliError("usage: conferences near <city>", EXIT.USAGE);
  const { source, synced_at, rows } = await resolveSource(ctx.dataSource, nowIso());
  const today = todayIsoDate(nowIso());
  const state = str(ctx.args, "state");
  const hits = near(rows, city, {
    state,
    upcoming: bool(ctx.args, "upcoming"),
    todayDate: today,
  });
  return emit(ctx, "conferences near", hits, { source, synced_at }, {
    props: { city, state: state ?? null },
  });
}

export async function cmdStats(ctx: Ctx): Promise<number> {
  const by = (str(ctx.args, "by") ?? "focus") as StatBy;
  if (!["focus", "state", "type", "month"].includes(by)) {
    throw new CliError("--by must be focus|state|type|month", EXIT.USAGE);
  }
  const { source, synced_at, rows } = await resolveSource(ctx.dataSource, nowIso());
  const agg = stats(rows, by);
  const env = envelope(agg, { source, synced_at, data_source: ctx.dataSource });
  await deliver(renderEnvelope(env as never, ctx.output), ctx.output.deliver, contentTypeFor(ctx.output));
  capture(ctx.telemetry, "cli_command", { command: "conferences stats", by, surface: "cli" });
  return EXIT.OK;
}

export async function cmdIcs(ctx: Ctx): Promise<number> {
  const { source, synced_at, rows } = await resolveSource(ctx.dataSource, nowIso());
  const all = bool(ctx.args, "all");
  let subset;
  if (all) {
    const today = todayIsoDate(nowIso());
    subset = rows.filter((c) => isUpcoming(c, today));
    if (subset.length === 0) {
      throw new CliError("no upcoming conferences to export", EXIT.NOT_FOUND);
    }
  } else {
    const slug = ctx.args.positionals[0];
    if (!slug) throw new CliError("usage: conferences ics <slug> | --all", EXIT.USAGE);
    const found = getBySlug(rows, slug);
    if (!found) throw new CliError(`no conference with slug "${slug}"`, EXIT.NOT_FOUND);
    subset = [found];
    capture(ctx.telemetry, "conference_viewed", { slug, surface: "cli", via: "ics" });
  }
  const ics = buildIcs(subset, synced_at);
  await deliver(ics, ctx.output.deliver, "text/calendar");
  return EXIT.OK;
}
