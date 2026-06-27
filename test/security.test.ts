import { test } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_FIELDS, stripToPublic, assertSelectable } from "../src/core/fields.js";

test("PUBLIC_FIELDS contains no internal columns", () => {
  const forbidden = [
    "status", "completion_pct", "field_sources", "conflicts",
    "contact_email", "contact_phone", "sponsorship_pricing", "review_status",
    "reviewed_by", "qa_passed", "discovery_source",
    "mcp_playwright_at", "mcp_brave_at", "mcp_exa_at", "mcp_duckduckgo_at",
  ];
  for (const f of forbidden) {
    assert.ok(!(PUBLIC_FIELDS as readonly string[]).includes(f), `${f} must not be public`);
  }
});

test("stripToPublic drops any non-allowlisted key (defense in depth)", () => {
  const raw = {
    slug: "x-2026",
    name: "X",
    status: "live", // internal — must be dropped
    field_sources: [{ secret: true }], // internal — must be dropped
    contact_email: "leak@example.com", // internal — must be dropped
  };
  const out = stripToPublic(raw as Record<string, unknown>) as Record<string, unknown>;
  assert.equal(out.slug, "x-2026");
  assert.equal(out.name, "X");
  assert.ok(!("status" in out), "status leaked");
  assert.ok(!("field_sources" in out), "field_sources leaked");
  assert.ok(!("contact_email" in out), "contact_email leaked");
});

test("stripToPublic fills missing public fields with null (stable shape)", () => {
  const out = stripToPublic({ slug: "x", name: "X" }) as Record<string, unknown>;
  for (const f of PUBLIC_FIELDS) assert.ok(f in out, `${f} should be present`);
  assert.equal(out.ceu_info, null);
});

test("assertSelectable accepts public top-level and dotted jsonb paths", () => {
  assert.doesNotThrow(() => assertSelectable(["slug", "name", "ceu_info.credits", "attendance_pricing.early_bird"]));
});

test("assertSelectable rejects internal/unknown fields", () => {
  assert.throws(() => assertSelectable(["contact_email"]), /not a public field/);
  assert.throws(() => assertSelectable(["status"]), /not a public field/);
  assert.throws(() => assertSelectable(["nope"]), /not a public field/);
});
