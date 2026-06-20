#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveSource } from "../core/source.js";
import {
  filterList,
  getBySlug,
  search,
  near,
  stats,
  todayIsoDate,
  type StatBy,
} from "../core/query.js";
import { buildIcs } from "../core/ics.js";
import { envelope } from "../core/envelope.js";
import { capture } from "../core/analytics.js";
import { PKG_VERSION } from "../core/config.js";

const telemetry =
  process.env.DO_NOT_TRACK !== "1" && process.env.HEALTHLEADER_TELEMETRY !== "0";
const nowIso = (): string => new Date().toISOString();

/** All MCP tools read from "auto" (live, snapshot fallback). */
const MODE = "auto" as const;

function jsonContent(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

const server = new McpServer({ name: "healthleader", version: PKG_VERSION });

const READ_ONLY = { readOnlyHint: true, openWorldHint: true };

server.registerTool(
  "list_conferences",
  {
    title: "List healthcare conferences",
    description:
      "List curated healthcare conferences (Medicare, Medicaid, payer, quality) with filters. " +
      'Example: { "focus": "Medicare", "upcoming": true, "state": "FL" }.',
    inputSchema: {
      focus: z.string().optional().describe("Focus area or theme, e.g. Medicare, Medicaid, Quality"),
      state: z.string().optional().describe("Two-letter US state, e.g. TX"),
      city: z.string().optional(),
      from: z.string().optional().describe("Start date >= YYYY-MM-DD"),
      to: z.string().optional().describe("Start date <= YYYY-MM-DD"),
      virtual: z.boolean().optional(),
      hybrid: z.boolean().optional(),
      ceu: z.boolean().optional().describe("Only events offering CEU/CME credit"),
      member_only: z.boolean().optional(),
      type: z.string().optional().describe("conference|summit|forum|expo|webinar"),
      upcoming: z.boolean().optional().describe("Only events starting today or later"),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    annotations: READ_ONLY,
  },
  async (a) => {
    const { source, synced_at, rows } = await resolveSource(MODE, nowIso());
    const results = filterList(
      rows,
      {
        focus: a.focus,
        state: a.state,
        city: a.city,
        from: a.from,
        to: a.to,
        virtual: a.virtual,
        hybrid: a.hybrid,
        ceu: a.ceu,
        memberOnly: a.member_only,
        type: a.type,
        upcoming: a.upcoming,
        limit: a.limit,
        offset: a.offset,
      },
      todayIsoDate(nowIso()),
    );
    capture(telemetry, "mcp_tool_call", { tool: "list_conferences", result_count: results.length });
    return jsonContent(envelope(results, { source, synced_at, data_source: MODE }));
  },
);

server.registerTool(
  "get_conference",
  {
    title: "Get a conference by slug",
    description: "Return the full public record for one conference by its slug.",
    inputSchema: { slug: z.string().describe("Conference slug, e.g. rise-west-2026") },
    annotations: READ_ONLY,
  },
  async (a) => {
    const { source, synced_at, rows } = await resolveSource(MODE, nowIso());
    const found = getBySlug(rows, a.slug);
    capture(telemetry, "mcp_tool_call", { tool: "get_conference", found: Boolean(found) });
    if (!found) return { content: [{ type: "text" as const, text: `No conference with slug "${a.slug}".` }], isError: true };
    return jsonContent(envelope([found], { source, synced_at, data_source: MODE }));
  },
);

server.registerTool(
  "search_conferences",
  {
    title: "Search conferences",
    description: "Relevance search over conference name, host, description, and themes.",
    inputSchema: { query: z.string(), limit: z.number().int().positive().optional() },
    annotations: READ_ONLY,
  },
  async (a) => {
    const { source, synced_at, rows } = await resolveSource(MODE, nowIso());
    const hits = search(rows, a.query, a.limit);
    capture(telemetry, "mcp_tool_call", { tool: "search_conferences", result_count: hits.length });
    // Capture the query text only when it returns nothing — gap-loop signal.
    if (hits.length === 0)
      capture(telemetry, "cli_zero_result", { command: "search_conferences", query: a.query, surface: "mcp" });
    return jsonContent(envelope(hits, { source, synced_at, data_source: MODE }));
  },
);

server.registerTool(
  "conferences_near",
  {
    title: "Conferences near a city",
    description: "Find conferences in or near a city (matches city or nearest airport).",
    inputSchema: {
      city: z.string(),
      state: z.string().optional(),
      upcoming: z.boolean().optional(),
    },
    annotations: READ_ONLY,
  },
  async (a) => {
    const { source, synced_at, rows } = await resolveSource(MODE, nowIso());
    const hits = near(rows, a.city, { state: a.state, upcoming: a.upcoming, todayDate: todayIsoDate(nowIso()) });
    capture(telemetry, "mcp_tool_call", { tool: "conferences_near", result_count: hits.length });
    return jsonContent(envelope(hits, { source, synced_at, data_source: MODE }));
  },
);

server.registerTool(
  "conference_ics",
  {
    title: "Conference calendar (.ics)",
    description: "Return an iCalendar (.ics) document for one conference by slug.",
    inputSchema: { slug: z.string() },
    annotations: READ_ONLY,
  },
  async (a) => {
    const { synced_at, rows } = await resolveSource(MODE, nowIso());
    const found = getBySlug(rows, a.slug);
    capture(telemetry, "mcp_tool_call", { tool: "conference_ics", found: Boolean(found) });
    if (!found) return { content: [{ type: "text" as const, text: `No conference with slug "${a.slug}".` }], isError: true };
    return { content: [{ type: "text" as const, text: buildIcs([found], synced_at) }] };
  },
);

server.registerTool(
  "directory_stats",
  {
    title: "Directory statistics",
    description: "Aggregate counts across the live directory, grouped by focus, state, type, or month.",
    inputSchema: { by: z.enum(["focus", "state", "type", "month"]).optional() },
    annotations: READ_ONLY,
  },
  async (a) => {
    const { source, synced_at, rows } = await resolveSource(MODE, nowIso());
    const agg = stats(rows, (a.by ?? "focus") as StatBy);
    capture(telemetry, "mcp_tool_call", { tool: "directory_stats", by: a.by ?? "focus" });
    return jsonContent(envelope(agg, { source, synced_at, data_source: MODE }));
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
