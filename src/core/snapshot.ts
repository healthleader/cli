import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stripToPublic, type Conference } from "./fields.js";

/**
 * Loads the bundled offline snapshot (data/conferences.json), shipped in the
 * npm package and refreshed by CI. Powers `--data-source local` and the
 * fallback path of `--data-source auto` when the network is unavailable.
 */
let cached: { built_at: string | null; rows: Conference[] } | null = null;

function snapshotPath(): string {
  // dist/core/snapshot.js -> ../../data/conferences.json
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "data", "conferences.json");
}

export async function loadSnapshot(): Promise<{ built_at: string | null; rows: Conference[] }> {
  if (cached) return cached;
  try {
    const text = await readFile(snapshotPath(), "utf8");
    const parsed = JSON.parse(text) as
      | { meta?: { synced_at?: string }; results?: Record<string, unknown>[] }
      | Record<string, unknown>[];
    const rows = Array.isArray(parsed) ? parsed : (parsed.results ?? []);
    const built_at = Array.isArray(parsed) ? null : (parsed.meta?.synced_at ?? null);
    cached = { built_at, rows: rows.map(stripToPublic) };
  } catch {
    cached = { built_at: null, rows: [] };
  }
  return cached;
}
