import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

/**
 * Anonymous, opt-out usage analytics. Feeds the weekly gap-loop (which
 * filters agents use, what returns zero results). No PII: a random per-install
 * id, allowlisted property keys only, fire-and-forget with a hard timeout.
 * Honors DO_NOT_TRACK=1, HEALTHLEADER_TELEMETRY=0, and --no-telemetry.
 */
const POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_KEY = "phc_iqncN5oxPLvM9rLS87yn1LISna1Asw8iHsPNxgozYyk";

function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "healthleader");
}

function installId(): string {
  const path = join(configDir(), "id");
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    const id = randomUUID();
    try {
      mkdirSync(configDir(), { recursive: true });
      writeFileSync(path, id, "utf8");
    } catch {
      /* ignore — analytics must never break the CLI */
    }
    return id;
  }
}

export type AnalyticsEvent =
  | "cli_command"
  | "cli_zero_result"
  | "cli_which"
  | "mcp_tool_call"
  | "conference_viewed";

export function capture(
  enabled: boolean,
  event: AnalyticsEvent,
  properties: Record<string, unknown>,
): void {
  if (!enabled) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 500);
  fetch(`${POSTHOG_HOST}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: installId(),
      properties: { ...properties, $lib: "healthleader-cli" },
    }),
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
}

let noticeShown = false;
/** One-time, stderr-only first-run notice. */
export function maybeFirstRunNotice(enabled: boolean): void {
  if (!enabled || noticeShown) return;
  const flag = join(configDir(), "telemetry-notice");
  try {
    readFileSync(flag, "utf8");
    return; // already shown
  } catch {
    noticeShown = true;
    process.stderr.write(
      "healthleader collects anonymous usage stats to improve the directory. " +
        "Opt out with --no-telemetry or DO_NOT_TRACK=1.\n",
    );
    try {
      mkdirSync(configDir(), { recursive: true });
      writeFileSync(flag, "1", "utf8");
    } catch {
      /* ignore */
    }
  }
}
