import { writeFile } from "node:fs/promises";
import type { Envelope } from "../core/envelope.js";
import { CliError, EXIT } from "../core/errors.js";

export type OutputOpts = {
  json: boolean;
  compact: boolean;
  csv: boolean;
  select?: string[];
  deliver?: string; // stdout | file:<path> | webhook:<url>
  color: boolean;
  isTty: boolean;
};

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function project<T>(rows: T[], select: string[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const o: Record<string, unknown> = {};
    for (const p of select) o[p] = getByPath(row, p);
    return o;
  });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown): string => {
    const s =
      v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
}

/** Render an envelope to a string per the chosen format. */
export function renderEnvelope<T extends Record<string, unknown>>(
  env: Envelope<T>,
  opts: OutputOpts,
): string {
  const rows: Record<string, unknown>[] = opts.select
    ? project(env.results, opts.select)
    : (env.results as Record<string, unknown>[]);

  if (opts.csv) return toCsv(rows);

  // JSON when explicitly requested, or when piped (non-TTY) with no human format.
  const wantsJson = opts.json || !opts.isTty;
  if (wantsJson) {
    const payload = opts.select ? { ...env, results: rows } : env;
    return JSON.stringify(payload, null, opts.compact ? 0 : 2);
  }

  return renderTable(env, rows);
}

function renderTable<T extends Record<string, unknown>>(
  env: Envelope<T>,
  rows: Record<string, unknown>[],
): string {
  if (rows.length === 0) {
    return `No results.  (source: ${env.meta.source}, ${env.meta.count} rows)`;
  }
  // Default human columns when no --select given.
  const cols = Object.keys(rows[0]!).includes("name")
    ? ["start_date", "name", "location_city", "location_state", "focus_area"].filter((c) =>
        Object.keys(rows[0]!).includes(c),
      )
    : Object.keys(rows[0]!);

  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)),
  );
  const line = (cells: string[]) =>
    cells.map((s, i) => s.padEnd(widths[i]!)).join("  ");
  const out = [
    line(cols),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map((r) => line(cols.map((c) => String(r[c] ?? "")))),
    "",
    `${env.meta.count} result(s) · source: ${env.meta.source} · synced: ${env.meta.synced_at}`,
  ];
  return out.join("\n");
}

/** Deliver rendered text to the chosen sink. */
export async function deliver(text: string, target: string | undefined): Promise<void> {
  if (!target || target === "stdout") {
    process.stdout.write(text.endsWith("\n") ? text : text + "\n");
    return;
  }
  if (target.startsWith("file:")) {
    await writeFile(target.slice(5), text, "utf8");
    return;
  }
  if (target.startsWith("webhook:")) {
    const url = target.slice(8);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
    });
    if (!res.ok) throw new CliError(`webhook delivery failed (HTTP ${res.status})`, EXIT.API);
    return;
  }
  throw new CliError(`unknown --deliver target: ${target}`, EXIT.USAGE);
}
