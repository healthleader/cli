import { test } from "node:test";
import assert from "node:assert/strict";
import type { Conference } from "../src/core/fields.js";
import {
  filterList,
  search,
  near,
  stats,
  isUpcoming,
  coverageWindow,
  todayIsoDate,
} from "../src/core/query.js";
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
    conference_series_id: null, updated_at: null,
    ...p,
  };
}

const TODAY = "2026-06-19";
const fix: Conference[] = [
  conf({ slug: "a-2026", name: "Medicare Summit", start_date: "2026-03-01", location_state: "FL", focus_area: "Medicare", ceu_offered: true }),
  conf({ slug: "b-2026", name: "Medicaid Forum", start_date: "2026-09-01", location_state: "TX", focus_themes: ["Medicaid", "Quality"], is_virtual: true }),
  conf({ slug: "c-2025", name: "Past Expo", start_date: "2025-01-01", location_state: "CA", focus_area: "Digital Health" }),
];

test("filterList defaults to UPCOMING-only (past excluded with no flags)", () => {
  const { rows, total } = filterList(fix, {}, TODAY);
  assert.deepEqual(rows.map((c) => c.slug), ["b-2026"]);
  assert.equal(total, 1);
});

test("isUpcoming uses end_date so in-progress multi-day events still count", () => {
  const inProgress = conf({ slug: "ip", start_date: "2026-06-18", end_date: "2026-06-20" });
  assert.equal(isUpcoming(inProgress, TODAY), true); // started yesterday, ends tomorrow
  assert.equal(isUpcoming(conf({ start_date: "2026-06-17", end_date: "2026-06-18" }), TODAY), false);
});

test("filterList --include-past returns the full archive, sorted asc", () => {
  const { rows } = filterList(fix, { includePast: true }, TODAY);
  assert.deepEqual(rows.map((c) => c.slug), ["c-2025", "a-2026", "b-2026"]);
});

test("explicit --from opts into the past within range (disables upcoming floor)", () => {
  const { rows } = filterList(fix, { from: "2025-01-01", to: "2026-06-30" }, TODAY);
  assert.deepEqual(rows.map((c) => c.slug), ["c-2025", "a-2026"]);
});

test("bare --to keeps the upcoming floor (no archive flood)", () => {
  // A lone upper bound must NOT surface the whole past archive.
  const { rows } = filterList(fix, { to: "2026-12-31" }, TODAY);
  assert.deepEqual(rows.map((c) => c.slug), ["b-2026"]);
});

test("filterList --focus matches focus_area OR themes", () => {
  assert.deepEqual(filterList(fix, { focus: "medicaid" }, TODAY).rows.map((c) => c.slug), ["b-2026"]);
  assert.deepEqual(filterList(fix, { focus: "Medicare", includePast: true }, TODAY).rows.map((c) => c.slug), ["a-2026"]);
});

test("filterList --state / --ceu / --virtual", () => {
  assert.deepEqual(filterList(fix, { state: "tx" }, TODAY).rows.map((c) => c.slug), ["b-2026"]);
  assert.deepEqual(filterList(fix, { ceu: true, includePast: true }, TODAY).rows.map((c) => c.slug), ["a-2026"]);
  assert.deepEqual(filterList(fix, { virtual: true }, TODAY).rows.map((c) => c.slug), ["b-2026"]);
});

test("filterList limit/offset reports unsliced total", () => {
  const { rows, total } = filterList(fix, { includePast: true, limit: 1, offset: 1 }, TODAY);
  assert.deepEqual(rows.map((c) => c.slug), ["a-2026"]);
  assert.equal(total, 3);
});

test("coverageWindow reports upcoming count and next event date", () => {
  const cw = coverageWindow(fix, TODAY);
  assert.equal(cw.total_live, 3);
  assert.equal(cw.upcoming_count, 1);
  assert.equal(cw.next_event_date, "2026-09-01");
});

test("search ranks name matches highest, empty query returns nothing", () => {
  assert.equal(search(fix, "").length, 0);
  assert.equal(search(fix, "medicaid")[0]!.slug, "b-2026");
});

test("near matches city or nearest airport, with state/upcoming", () => {
  const r = [conf({ slug: "orl", name: "O", start_date: "2026-12-01", location_city: "Orlando", location_state: "FL" })];
  assert.equal(near(r, "orlando", { todayDate: TODAY }).length, 1);
  assert.equal(near(r, "orlando", { state: "TX", todayDate: TODAY }).length, 0);
});

test("stats groups and counts", () => {
  assert.equal(stats(fix, "state").reduce((n, x) => n + x.count, 0), 3);
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
  assert.match(ics, /DTEND;VALUE=DATE:20260905/);
  assert.match(ics, /SUMMARY:RISE\\, West/);
});

test("matchIntent maps focus+state, calendar intent, flags search fallback, empty -> null", () => {
  const m = matchIntent("medicare conferences in texas");
  assert.equal(m?.command, "conferences list");
  assert.equal((m?.flags as Record<string, unknown>).focus, "Medicare");
  assert.equal((m?.flags as Record<string, unknown>).state, "TX");
  assert.equal(m?.fallback, undefined); // a confident structured mapping
  assert.equal(matchIntent("add this to my calendar")?.command, "conferences ics");
  assert.equal(matchIntent("blorptastic widget expo")?.fallback, true); // unmapped -> search fallback
  assert.equal(matchIntent(""), null);
});

test("envelope: pagination total drives has_more", () => {
  const e = envelope([{ slug: "a" }], { source: "live", synced_at: "t", data_source: "auto", total: 5, offset: 0, limit: 1 });
  assert.equal(e.meta.count, 1);
  assert.equal(e.meta.total, 5);
  assert.equal(e.meta.has_more, true);
  const e2 = envelope([{ slug: "a" }], { source: "live", synced_at: "t", data_source: "auto", total: 1 });
  assert.equal(e2.meta.has_more, false);
});
