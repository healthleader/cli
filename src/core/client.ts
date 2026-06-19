import { SUPABASE_URL, SUPABASE_ANON_KEY, TABLE } from "./config.js";
import { selectClause, stripToPublic, type Conference } from "./fields.js";
import { CliError, EXIT } from "./errors.js";

/**
 * A PostgREST query expressed as ordered filter pairs plus modifiers.
 * Each filter is `column=op.value` (e.g. `status=eq.live`, `start_date=gte.2026-01-01`).
 */
export type PostgrestQuery = {
  filters?: string[]; // raw `col=op.value` strings, already URL-safe except value
  order?: string; // e.g. "start_date.asc"
  limit?: number;
  offset?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

function buildUrl(q: PostgrestQuery): string {
  const params = new URLSearchParams();
  params.set("select", selectClause());
  // Always constrain to live rows. RLS should already do this post-Phase-0,
  // but we never rely on it alone.
  params.append("status", "eq.live");
  for (const f of q.filters ?? []) {
    const eq = f.indexOf("=");
    if (eq === -1) continue;
    params.append(f.slice(0, eq), f.slice(eq + 1));
  }
  if (q.order) params.set("order", q.order);
  if (q.limit != null) params.set("limit", String(q.limit));
  if (q.offset != null) params.set("offset", String(q.offset));
  return `${SUPABASE_URL}/rest/v1/${TABLE}?${params.toString()}`;
}

/** Fetch live conferences from PostgREST, stripped to the public allowlist. */
export async function fetchLive(q: PostgrestQuery): Promise<Conference[]> {
  const url = buildUrl(q);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (err) {
    throw new CliError(
      `network error contacting directory: ${(err as Error).message}`,
      EXIT.API,
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    throw new CliError("directory rejected the request (auth)", EXIT.AUTH);
  }
  if (res.status === 429) {
    throw new CliError("rate limited by the directory; retry shortly", EXIT.RATE_LIMITED);
  }
  if (!res.ok) {
    throw new CliError(`directory error (HTTP ${res.status})`, EXIT.API);
  }

  const raw = (await res.json()) as Record<string, unknown>[];
  return raw.map(stripToPublic);
}
