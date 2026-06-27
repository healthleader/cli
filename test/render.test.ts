import { test } from "node:test";
import assert from "node:assert/strict";
import { safeFilePath, safeWebhookUrl, contentTypeFor, type OutputOpts } from "../src/cli/render.js";

const opts = (o: Partial<OutputOpts>): OutputOpts => ({
  json: false, compact: false, csv: false, color: true, isTty: true, ...o,
});

test("safeFilePath allows files within cwd", () => {
  assert.doesNotThrow(() => safeFilePath("out.json"));
  assert.doesNotThrow(() => safeFilePath("sub/dir/out.ics"));
});

test("safeFilePath blocks parent traversal", () => {
  assert.throws(() => safeFilePath("../escape.json"), /current directory/);
  assert.throws(() => safeFilePath("../../etc/passwd"), /current directory/);
});

test("safeFilePath blocks absolute paths outside cwd", () => {
  assert.throws(() => safeFilePath("/etc/passwd"), /current directory/);
  assert.throws(() => safeFilePath("/tmp/evil"), /current directory/);
});

test("safeWebhookUrl requires https", () => {
  assert.throws(() => safeWebhookUrl("http://example.com/x"), /https/);
  assert.throws(() => safeWebhookUrl("ftp://example.com"), /https/);
});

test("safeWebhookUrl blocks loopback/private/metadata hosts (SSRF)", () => {
  assert.throws(() => safeWebhookUrl("https://localhost/x"), /private\/loopback/);
  assert.throws(() => safeWebhookUrl("https://127.0.0.1/x"), /private\/loopback/);
  assert.throws(() => safeWebhookUrl("https://169.254.169.254/latest/meta-data"), /private\/loopback/);
  assert.throws(() => safeWebhookUrl("https://10.0.0.5/x"), /private\/loopback/);
  assert.throws(() => safeWebhookUrl("https://192.168.1.1/x"), /private\/loopback/);
  assert.throws(() => safeWebhookUrl("https://172.16.0.1/x"), /private\/loopback/);
  assert.throws(() => safeWebhookUrl("https://metadata.google.internal/x"), /private\/loopback/);
});

test("safeWebhookUrl allows public https hosts", () => {
  assert.doesNotThrow(() => safeWebhookUrl("https://hooks.example.com/abc"));
  assert.equal(safeWebhookUrl("https://api.example.com/x").hostname, "api.example.com");
});

test("contentTypeFor maps format to MIME", () => {
  assert.equal(contentTypeFor(opts({ csv: true })), "text/csv");
  assert.equal(contentTypeFor(opts({ json: true })), "application/json");
  assert.equal(contentTypeFor(opts({ isTty: false })), "application/json"); // piped
  assert.equal(contentTypeFor(opts({ isTty: true })), "text/plain"); // human table
});
