import { PKG_VERSION } from "./config.js";

export type DataSourceMode = "auto" | "live" | "local";
export type ResolvedSource = "live" | "local";

export type Envelope<T> = {
  meta: {
    source: ResolvedSource;
    synced_at: string; // ISO; request time for live, snapshot build time for local
    count: number;
    version: string;
    data_source: DataSourceMode;
  };
  results: T[];
};

export function envelope<T>(
  results: T[],
  meta: { source: ResolvedSource; synced_at: string; data_source: DataSourceMode },
): Envelope<T> {
  return {
    meta: {
      source: meta.source,
      synced_at: meta.synced_at,
      count: results.length,
      version: PKG_VERSION,
      data_source: meta.data_source,
    },
    results,
  };
}
