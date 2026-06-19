import type { Conference } from "./fields.js";

export type ListParams = {
  focus?: string;
  state?: string;
  city?: string;
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
  virtual?: boolean;
  hybrid?: boolean;
  ceu?: boolean;
  memberOnly?: boolean;
  type?: string;
  upcoming?: boolean;
  sort?: string; // field name, default start_date
  limit?: number;
  offset?: number;
};

const lc = (s: unknown): string => (typeof s === "string" ? s.toLowerCase() : "");

/** ISO YYYY-MM-DD strings sort lexicographically, so string compare is safe. */
export function todayIsoDate(nowIso: string): string {
  return nowIso.slice(0, 10);
}

function matchesFocus(c: Conference, focus: string): boolean {
  const f = focus.toLowerCase();
  if (lc(c.focus_area).includes(f)) return true;
  return (c.focus_themes ?? []).some((t) => lc(t).includes(f));
}

export function filterList(rows: Conference[], p: ListParams, todayDate: string): Conference[] {
  let out = rows.filter((c) => {
    if (p.focus && !matchesFocus(c, p.focus)) return false;
    if (p.state && lc(c.location_state) !== p.state.toLowerCase()) return false;
    if (p.city && !lc(c.location_city).includes(p.city.toLowerCase())) return false;
    if (p.type && !lc(c.conference_type).includes(p.type.toLowerCase())) return false;
    if (p.virtual && c.is_virtual !== true) return false;
    if (p.hybrid && c.is_hybrid !== true) return false;
    if (p.ceu && c.ceu_offered !== true) return false;
    if (p.memberOnly && c.is_member_only !== true) return false;
    if (p.upcoming && !(c.start_date && c.start_date >= todayDate)) return false;
    if (p.from && !(c.start_date && c.start_date >= p.from)) return false;
    if (p.to && !(c.start_date && c.start_date <= p.to)) return false;
    return true;
  });

  const sortKey = (p.sort ?? "start_date") as keyof Conference;
  out = [...out].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls last
    if (bv == null) return -1;
    return String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
  });

  const offset = p.offset ?? 0;
  const end = p.limit != null ? offset + p.limit : undefined;
  return out.slice(offset, end);
}

export function getBySlug(rows: Conference[], slug: string): Conference | undefined {
  return rows.find((c) => c.slug === slug);
}

/** Lightweight relevance search over the public text fields. */
export function search(rows: Conference[], query: string, limit?: number): Conference[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored = rows
    .map((c) => {
      const hay = [
        c.name,
        c.host_org,
        c.host_org_abbrev,
        c.short_description,
        c.long_description,
        c.focus_area,
        ...(c.focus_themes ?? []),
      ]
        .map(lc)
        .join("  ");
      let score = 0;
      for (const t of terms) {
        if (!hay.includes(t)) continue;
        score += 1;
        if (lc(c.name).includes(t)) score += 2; // name matches weigh more
      }
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const hits = scored.map((x) => x.c);
  return limit != null ? hits.slice(0, limit) : hits;
}

export function near(
  rows: Conference[],
  city: string,
  opts: { state?: string; upcoming?: boolean; todayDate: string },
): Conference[] {
  const needle = city.toLowerCase();
  return rows.filter((c) => {
    const hit =
      lc(c.location_city).includes(needle) || lc(c.nearest_airport).includes(needle);
    if (!hit) return false;
    if (opts.state && lc(c.location_state) !== opts.state.toLowerCase()) return false;
    if (opts.upcoming && !(c.start_date && c.start_date >= opts.todayDate)) return false;
    return true;
  });
}

export type StatBy = "focus" | "state" | "type" | "month";

export function stats(rows: Conference[], by: StatBy): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of rows) {
    let key: string;
    switch (by) {
      case "focus":
        key = c.focus_area ?? "(unspecified)";
        break;
      case "state":
        key = c.location_state ?? "(unspecified)";
        break;
      case "type":
        key = c.conference_type ?? "(unspecified)";
        break;
      case "month":
        key = c.start_date ? c.start_date.slice(0, 7) : "(undated)";
        break;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
}
