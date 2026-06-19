/**
 * Build the offline snapshot shipped in the npm package (data/conferences.json).
 * Run by CI on a schedule and locally via `npm run snapshot`. Reuses the same
 * public-field projection + status=live constraint as the live CLI path.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchLive } from "../src/core/client.js";

async function main(): Promise<void> {
  const rows = await fetchLive({ order: "start_date.asc" });
  const out = {
    meta: {
      synced_at: new Date().toISOString(),
      count: rows.length,
      source: "healthleader.ai conference directory (live, status=live)",
    },
    results: rows,
  };
  const here = dirname(fileURLToPath(import.meta.url));
  const dest = join(here, "..", "data", "conferences.json");
  await writeFile(dest, JSON.stringify(out, null, 2) + "\n", "utf8");
  process.stdout.write(`wrote ${rows.length} conferences to ${dest}\n`);
}

main().catch((err) => {
  process.stderr.write(`snapshot failed: ${(err as Error).message}\n`);
  process.exit(1);
});
