/**
 * Natural-language intent → command mapping. Data-driven so the PostHog loop
 * (cli_which matched:false) can grow the table over time.
 */
export type IntentMatch = {
  command: string;
  flags: Record<string, string | boolean>;
  note?: string;
};

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

const FOCUS_KEYWORDS: { re: RegExp; focus: string }[] = [
  { re: /\bmedicare\b/, focus: "Medicare" },
  { re: /\bmedicaid\b/, focus: "Medicaid" },
  { re: /\bbehavioral health\b|\bmental health\b/, focus: "Behavioral Health" },
  { re: /\bquality\b|\bhedis\b|\bstars\b/, focus: "Quality" },
  { re: /\bdigital health\b/, focus: "Digital Health" },
  { re: /\bvalue[- ]based\b/, focus: "Value-Based Care" },
  { re: /\bhealth (?:insurance|plan|plans|payer|payor)\b/, focus: "Health Insurance" },
];

export function matchIntent(intent: string): IntentMatch | null {
  const q = intent.toLowerCase().trim();
  if (!q) return null;

  // Calendar export intent
  if (/\b(add to|calendar|\.ics|ical|remind me)\b/.test(q)) {
    return { command: "conferences ics", flags: {}, note: "needs a slug; resolve via search first" };
  }

  const flags: Record<string, string | boolean> = {};

  for (const { re, focus } of FOCUS_KEYWORDS) {
    if (re.test(q)) {
      flags.focus = focus;
      break;
    }
  }
  for (const [name, abbr] of Object.entries(US_STATES)) {
    if (new RegExp(`\\b${name}\\b`).test(q)) {
      flags.state = abbr;
      break;
    }
  }
  if (/\b(upcoming|coming up|next|this year|2026|future)\b/.test(q)) flags.upcoming = true;
  if (/\b(virtual|online|remote)\b/.test(q)) flags.virtual = true;
  if (/\b(ceu|cme|continuing education|credits?)\b/.test(q)) flags.ceu = true;

  if (Object.keys(flags).length > 0) {
    return { command: "conferences list", flags };
  }

  // Fall back to free-text search if the intent names something specific.
  if (q.split(/\s+/).length >= 1) {
    return { command: "conferences search", flags: { _query: intent.trim() } };
  }
  return null;
}
