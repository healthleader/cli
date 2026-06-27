import { PKG_VERSION } from "./config.js";

export type DataSourceMode = "auto" | "live" | "local";
export type ResolvedSource = "live" | "local";

export type CoverageWindow = {
  total_live: number;
  upcoming_count: number;
  next_event_date: string | null;
};

export type EnvelopeMeta = {
  source: ResolvedSource;
  synced_at: string; // ISO; request time for live, snapshot build time for local
  count: number; // rows in THIS response (page size)
  version: string;
  data_source: DataSourceMode;
  total?: number; // total rows matching the query before limit/offset
  offset?: number;
  limit?: number;
  has_more?: boolean;
  coverage_window?: CoverageWindow;
};

export type Envelope<T> = { meta: EnvelopeMeta; results: T[] };

export type EnvelopeOpts = {
  source: ResolvedSource;
  synced_at: string;
  data_source: DataSourceMode;
  total?: number;
  offset?: number;
  limit?: number;
  coverage_window?: CoverageWindow;
};

export function envelope<T>(results: T[], opts: EnvelopeOpts): Envelope<T> {
  const meta: EnvelopeMeta = {
    source: opts.source,
    synced_at: opts.synced_at,
    count: results.length,
    version: PKG_VERSION,
    data_source: opts.data_source,
  };
  if (opts.total != null) {
    meta.total = opts.total;
    const offset = opts.offset ?? 0;
    meta.has_more = offset + results.length < opts.total;
    if (opts.offset != null) meta.offset = opts.offset;
    if (opts.limit != null) meta.limit = opts.limit;
  }
  if (opts.coverage_window) meta.coverage_window = opts.coverage_window;
  return { meta, results };
}
