import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, resolveGlobals, str, bool, num } from "../src/cli/args.js";

test("parseArgs separates positionals from flags", () => {
  const p = parseArgs(["conferences", "get", "rise-west-2026", "--agent"]);
  assert.deepEqual(p.positionals, ["conferences", "get", "rise-west-2026"]);
  assert.equal(p.flags.get("agent"), true);
});

test("parseArgs handles --flag value, --flag=value, and --no-flag", () => {
  const p = parseArgs(["list", "--focus", "Medicare", "--limit=5", "--no-color"]);
  assert.equal(str(p, "focus"), "Medicare");
  assert.equal(num(p, "limit"), 5);
  assert.equal(p.flags.get("color"), false);
});

test("parseArgs treats unknown bare flags as boolean", () => {
  const p = parseArgs(["list", "--upcoming", "--ceu"]);
  assert.equal(bool(p, "upcoming"), true);
  assert.equal(bool(p, "ceu"), true);
});

test("resolveGlobals: --agent expands to json+compact (PP grammar)", () => {
  const p = parseArgs(["list", "--agent"]);
  const g = resolveGlobals(p);
  assert.equal(g.agent, true);
  assert.equal(g.output.json, true);
  assert.equal(g.output.compact, true);
  assert.equal(g.output.color, false);
});

test("resolveGlobals: data-source defaults to auto, validates enum", () => {
  assert.equal(resolveGlobals(parseArgs(["list"])).dataSource, "auto");
  assert.equal(resolveGlobals(parseArgs(["list", "--data-source", "local"])).dataSource, "local");
  assert.throws(() => resolveGlobals(parseArgs(["list", "--data-source", "bogus"])), /data-source/);
});

test("resolveGlobals: invalid --select is rejected", () => {
  assert.throws(() => resolveGlobals(parseArgs(["list", "--select", "contact_email"])), /public field/);
  assert.doesNotThrow(() => resolveGlobals(parseArgs(["list", "--select", "slug,name"])));
});

test("resolveGlobals: telemetry honors DO_NOT_TRACK and --no-telemetry", () => {
  const prev = process.env.DO_NOT_TRACK;
  delete process.env.DO_NOT_TRACK;
  assert.equal(resolveGlobals(parseArgs(["list"])).telemetry, true);
  assert.equal(resolveGlobals(parseArgs(["list", "--no-telemetry"])).telemetry, false);
  process.env.DO_NOT_TRACK = "1";
  assert.equal(resolveGlobals(parseArgs(["list"])).telemetry, false);
  if (prev === undefined) delete process.env.DO_NOT_TRACK;
  else process.env.DO_NOT_TRACK = prev;
});
