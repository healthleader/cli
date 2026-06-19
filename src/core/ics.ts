import type { Conference } from "./fields.js";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD -> YYYYMMDD; returns null if not a date-only string. */
function toIcsDate(d: string | null): string | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

/** All-day DTEND is exclusive: the day after the last day. */
function dayAfter(d: string): string {
  const [y, mo, da] = d.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, mo - 1, da));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function fold(line: string): string {
  // RFC 5545: fold lines longer than 75 octets.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

function vevent(c: Conference, stampIso: string): string[] {
  const start = toIcsDate(c.start_date);
  const lastDay = c.end_date ?? c.start_date;
  const end = lastDay ? dayAfter(lastDay.slice(0, 10)) : null;
  const stamp = stampIso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

  const loc = [c.location_venue, c.location_city, c.location_state]
    .filter(Boolean)
    .join(", ");

  const lines: string[] = ["BEGIN:VEVENT", `UID:${c.slug}@healthleader.ai`, `DTSTAMP:${stamp}`];
  if (start) lines.push(`DTSTART;VALUE=DATE:${start}`);
  if (end) lines.push(`DTEND;VALUE=DATE:${end}`);
  lines.push(`SUMMARY:${escapeText(c.name)}`);
  if (loc) lines.push(`LOCATION:${escapeText(loc)}`);
  if (c.website_url) lines.push(`URL:${escapeText(c.website_url)}`);
  if (c.short_description) lines.push(`DESCRIPTION:${escapeText(c.short_description)}`);
  lines.push("END:VEVENT");
  return lines.map(fold);
}

/** Build a VCALENDAR document for one or more conferences. */
export function buildIcs(conferences: Conference[], stampIso: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HealthLeader.ai//Conference Directory//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...conferences.flatMap((c) => vevent(c, stampIso)),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
