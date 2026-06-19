import { fetchLive } from "./client.js";
import { loadSnapshot } from "./snapshot.js";
import type { Conference } from "./fields.js";
import type { DataSourceMode, ResolvedSource } from "./envelope.js";
import { CliError } from "./errors.js";

export type SourceResult = {
  source: ResolvedSource;
  synced_at: string;
  rows: Conference[];
};

/**
 * Resolve the conference set for a given data-source mode.
 *  - live:  PostgREST only (throws on failure)
 *  - local: bundled snapshot only (offline)
 *  - auto:  live, falling back to snapshot on any network/API error
 *
 * The full live set is small (~149 rows), so we fetch all live rows once and
 * let the query layer filter in-memory. This keeps live and local identical.
 */
export async function resolveSource(mode: DataSourceMode, nowIso: string): Promise<SourceResult> {
  if (mode === "local") {
    const snap = await loadSnapshot();
    return { source: "local", synced_at: snap.built_at ?? nowIso, rows: snap.rows };
  }

  if (mode === "live") {
    const rows = await fetchLive({ order: "start_date.asc" });
    return { source: "live", synced_at: nowIso, rows };
  }

  // auto
  try {
    const rows = await fetchLive({ order: "start_date.asc" });
    return { source: "live", synced_at: nowIso, rows };
  } catch (err) {
    if (err instanceof CliError) {
      const snap = await loadSnapshot();
      if (snap.rows.length > 0) {
        return { source: "local", synced_at: snap.built_at ?? nowIso, rows: snap.rows };
      }
    }
    throw err;
  }
}
