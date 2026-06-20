/**
 * Generate openapi.yaml from the PUBLIC_FIELDS allowlist (single source of
 * truth). Describes the public PostgREST read surface so API-aware agents can
 * call the directory directly with the correct projection. Run via `npm run openapi`.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PUBLIC_FIELDS } from "../src/core/fields.js";
import { SUPABASE_URL, PKG_VERSION } from "../src/core/config.js";

type Prop = { type: string; format?: string; items?: { type: string } };

const TYPE_MAP: Record<string, Prop> = {
  start_date: { type: "string", format: "date" },
  end_date: { type: "string", format: "date" },
  is_virtual: { type: "boolean" },
  is_hybrid: { type: "boolean" },
  is_member_only: { type: "boolean" },
  ceu_offered: { type: "boolean" },
  focus_themes: { type: "array", items: { type: "string" } },
  keynote_speakers: { type: "array", items: { type: "string" } },
  attendance_pricing: { type: "object" },
  ceu_info: { type: "object" },
};

function propYaml(field: string): string {
  const p = TYPE_MAP[field] ?? { type: "string" };
  const lines = [`        ${field}:`, `          type: ${p.type}`, `          nullable: true`];
  if (p.format) lines.push(`          format: ${p.format}`);
  if (p.items) lines.push(`          items:`, `            type: ${p.items.type}`);
  return lines.join("\n");
}

function build(): string {
  const props = PUBLIC_FIELDS.map(propYaml).join("\n");
  const select = PUBLIC_FIELDS.join(",");
  return `openapi: 3.1.0
info:
  title: HealthLeader.ai Conference Directory (public read API)
  version: "${PKG_VERSION}"
  description: >-
    Public, read-only directory of healthcare conferences (Medicare, Medicaid,
    payer, quality). Served via Supabase PostgREST. Only published (status=live)
    rows and the public fields below are exposed. No write operations.
  license:
    name: MIT
servers:
  - url: ${SUPABASE_URL}/rest/v1
security:
  - apikey: []
paths:
  /conferences:
    get:
      operationId: listConferences
      summary: List live healthcare conferences
      description: >-
        Always send select=${select} and status=eq.live. Filter with PostgREST
        operators, e.g. focus_area=ilike.*Medicare*, location_state=eq.TX,
        start_date=gte.2026-01-01, order=start_date.asc, limit=20.
      parameters:
        - name: select
          in: query
          required: true
          schema: { type: string, default: "${select}" }
        - name: status
          in: query
          required: true
          schema: { type: string, default: "eq.live", enum: ["eq.live"] }
        - name: order
          in: query
          schema: { type: string, example: "start_date.asc" }
        - name: limit
          in: query
          schema: { type: integer }
        - name: offset
          in: query
          schema: { type: integer }
      responses:
        "200":
          description: Array of conference records
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Conference"
components:
  securitySchemes:
    apikey:
      type: apiKey
      in: header
      name: apikey
      description: Public Supabase anon key (read-only, RLS-gated to status=live).
  schemas:
    Conference:
      type: object
      properties:
${props}
`;
}

const here = dirname(fileURLToPath(import.meta.url));
await writeFile(join(here, "..", "openapi.yaml"), build(), "utf8");
process.stdout.write(`wrote openapi.yaml (${PUBLIC_FIELDS.length} public fields)\n`);
