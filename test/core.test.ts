import { test } from "node:test";
import assert from "node:assert/strict";
import type { Conference } from "../src/core/fields.js";
import { filterList, search, near, stats, todayIsoDate } from "../src/core/query.js";
import { buildIcs } from "../src/core/ics.js";
import { matchIntent } from "../src/core/which.js";
import { envelope } from "../src/core/envelope.js";

function conf(p: Partial<Conference>): Conference {
  return {
    slug: "x", name: "X", host_org: null, host_org_abbrev: null,
    start_date: null, end_date: null, dates_display: null,
    location_city: null, location_state: null, location_venue: null,
    is_virtual: null, is_hybrid: null, nearest_airport: null,
    focus_area: null, focus_themes: null, conference_type: null,
    short_description: null, long_description: null,
    website_url: null, registration_url: null,
    attendance_pricing: null, early_bird_deadline: null, is_member_only: null,
    ceu_offered: null, ceu_info: null, keynote_speakers: null, expected_attendees: null,
    ...p,
  };
}

const rows: Conference[] = [
  conf({ slug: "a-2026", name: "Medicare Summit", start_date: "2026-03-01", location_state: "FL", focus_area: "Medicare", ceu_offered: true }),
  conf({ slug: "b-2026", name: "Medicaid Forum", start_date: "2026-09-01", location_state: "TX", focus_themes: ["Medicaid", "Quality"], is_virtual: true }),
  conf({ slug: "c-2025", name: "Past Expo", start_date: "2025-01-01", location_state: "CA", focus_area: "Digital Health" }),
];

const TODAY = "2026-06-19";

test("filterList --upcoming keeps only future starts", () => {
  const out = filterList(rows, { upcoming: true }, TODAY);
  assert.deepEqual(out.map((c) => c.slug), ["b-2026"]);
});

test("filterList --from/--to bounds by start_date", () => {
  const out = filterList(rows, { from: "2026-01-01", to: "2026-06-30" }, TODAY);
  assert.deepEqual(out.map((c) => c.slug), ["a-2026"]);
});

test("filterList --focus matches focus_area OR themes", () => {
  assert.deepEqual(filterList(rows, { focus: "medicaid" }, TODAY).map((c) => c.slug), ["b-2026"]);
  assert.deepEqual(filterList(rows, { focus: "Medicare" }, TODAY).map((c) => c.slug), ["a-2026"]);
});

test("filterList --state and --ceu and --virtual", () => {
  assert.deepEqual(filterList(rows, { state: "tx" }, TODAY).map((c) => c.slug), ["b-2026"]);
  assert.deepEqual(filterList(rows, { ceu: true }, TODAY).map((c) => c.slug), ["a-2026"]);
  assert.deepEqual(filterList(rows, { virtual: true }, TODAY).map((c) => c.slug), ["b-2026"]);
});

test("filterList sorts by start_date asc by default, honors limit/offset", () => {
  const out = filterList(rows, {}, TODAY);
  assert.deepEqual(out.map((c) => c.slug), ["c-2025", "a-2026", "b-2026"]);
  assert.deepEqual(filterList(rows, { limit: 1, offset: 1 }, TODAY).map((c) => c.slug), ["a-2026"]);
});

test("search ranks name matches highest, empty query returns nothing", () => {
  assert.equal(search(rows, "").length, 0);
  assert.equal(search(rows, "medicaid")[0]!.slug, "b-2026");
});

test("near matches city or nearest airport, with state/upcoming", () => {
  const r = [conf({ slug: "orl", name: "O", start_date: "2026-12-01", location_city: "Orlando", location_state: "FL" })];
  assert.equal(near(r, "orlando", { todayDate: TODAY }).length, 1);
  assert.equal(near(r, "orlando", { state: "TX", todayDate: TODAY }).length, 0);
});

test("stats groups and counts, sorted desc", () => {
  const s = stats(rows, "state");
  assert.equal(s.reduce((n, x) => n + x.count, 0), 3);
});

test("todayIsoDate slices ISO to date", () => {
  assert.equal(todayIsoDate("2026-06-19T01:23:45.000Z"), "2026-06-19");
});

test("buildIcs: DTEND is the day AFTER end_date (all-day exclusive), commas escaped", () => {
  const ics = buildIcs(
    [conf({ slug: "r", name: "RISE, West", start_date: "2026-09-02", end_date: "2026-09-04", location_venue: "Hyatt", location_city: "San Diego", location_state: "CA" })],
    "2026-06-19T00:00:00.000Z",
  );
  assert.match(ics, /DTSTART;VALUE=DATE:20260902/);
  assert.match(ics, /DTEND;VALUE=DATE:20260905/); // exclusive: day after the 4th
  assert.match(ics, /SUMMARY:RISE\\, West/); // comma escaped
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /END:VEVENT/);
});

test("matchIntent maps focus + state, calendar intent, and empty -> null", () => {
  const m = matchIntent("medicare conferences in texas");
  assert.equal(m?.command, "conferences list");
  assert.equal((m?.flags as Record<string, unknown>).focus, "Medicare");
  assert.equal((m?.flags as Record<string, unknown>).state, "TX");
  assert.equal(matchIntent("add this to my calendar")?.command, "conferences ics");
  assert.equal(matchIntent(""), null);
});

test("envelope wraps results with correct meta count", () => {
  const e = envelope([{ slug: "a" }], { source: "live", synced_at: "t", data_source: "auto" });
  assert.equal(e.meta.count, 1);
  assert.equal(e.meta.source, "live");
  assert.equal(e.results.length, 1);
});
