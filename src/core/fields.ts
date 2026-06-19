/**
 * The single source of truth for what is public.
 *
 * SECURITY: This allowlist is the only thing that decides which columns ever
 * leave the directory. Every PostgREST query sends `?select=<PUBLIC_FIELDS>`,
 * and every response is additionally stripped to these keys before emit
 * (defense in depth — we never trust RLS alone). Adding a column here exposes
 * it to the world; do not add internal columns (status, completion_pct,
 * field_sources, mcp_*_at, review_*, conflicts, contact_*, sponsorship_*).
 */
export const PUBLIC_FIELDS = [
  "slug",
  "name",
  "host_org",
  "host_org_abbrev",
  "start_date",
  "end_date",
  "dates_display",
  "location_city",
  "location_state",
  "location_venue",
  "is_virtual",
  "is_hybrid",
  "nearest_airport",
  "focus_area",
  "focus_themes",
  "conference_type",
  "short_description",
  "long_description",
  "website_url",
  "registration_url",
  "attendance_pricing",
  "early_bird_deadline",
  "is_member_only",
  "ceu_offered",
  "ceu_info",
  "keynote_speakers",
  "expected_attendees",
] as const;

export type PublicField = (typeof PUBLIC_FIELDS)[number];

/** A conference record limited to public fields. Values may be null. */
export type Conference = {
  slug: string;
  name: string;
  host_org: string | null;
  host_org_abbrev: string | null;
  start_date: string | null;
  end_date: string | null;
  dates_display: string | null;
  location_city: string | null;
  location_state: string | null;
  location_venue: string | null;
  is_virtual: boolean | null;
  is_hybrid: boolean | null;
  nearest_airport: string | null;
  focus_area: string | null;
  focus_themes: string[] | null;
  conference_type: string | null;
  short_description: string | null;
  long_description: string | null;
  website_url: string | null;
  registration_url: string | null;
  attendance_pricing: Record<string, unknown> | null;
  early_bird_deadline: string | null;
  is_member_only: boolean | null;
  ceu_offered: boolean | null;
  ceu_info: Record<string, unknown> | null;
  keynote_speakers: string[] | null;
  expected_attendees: string | null;
};

const PUBLIC_FIELD_SET: ReadonlySet<string> = new Set(PUBLIC_FIELDS);

/** The PostgREST `select=` value. */
export function selectClause(): string {
  return PUBLIC_FIELDS.join(",");
}

/**
 * Strip any key not in the allowlist from a raw record. Defense in depth:
 * even if the endpoint ever returned extra columns, they never reach output.
 */
export function stripToPublic(raw: Record<string, unknown>): Conference {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    out[key] = key in raw ? raw[key] : null;
  }
  return out as Conference;
}

/** Validate a caller-supplied --select against the allowlist (dotted paths allowed for jsonb). */
export function assertSelectable(paths: string[]): void {
  for (const p of paths) {
    const top = p.split(".")[0]!;
    if (!PUBLIC_FIELD_SET.has(top)) {
      throw new Error(`--select: "${p}" is not a public field`);
    }
  }
}
