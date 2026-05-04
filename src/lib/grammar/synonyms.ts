/**
 * synonyms.ts — Pre-processes natural-language input before tokenisation.
 *
 * Replaces multi-word phrases (operator synonyms, date phrases) with single
 * normalised __token__ words so the Nearley grammar only ever sees single tokens
 * for each concept.  Patterns are sorted longest-first to avoid partial matches.
 */

// ---------------------------------------------------------------------------
// Multi-word phrase → single token replacements
// ---------------------------------------------------------------------------

type Replacement = [RegExp, string | ((...args: string[]) => string)];

const PHRASE_REPLACEMENTS: Replacement[] = [
  // ── Comparison (longer first) ─────────────────────────────────────────
  [/greater\s+than\s+or\s+equals?\s*(?:to\s+)?/gi, "__gte__ "],
  [/less\s+than\s+or\s+equals?\s*(?:to\s+)?/gi,    "__lte__ "],
  [/no\s+less\s+than/gi,  "__gte__ "],
  [/no\s+more\s+than/gi,  "__lte__ "],
  [/at\s+least/gi,        "__gte__ "],
  [/at\s+most/gi,         "__lte__ "],
  [/greater\s+than/gi,    "__gt__ "],
  [/less\s+than/gi,       "__lt__ "],
  [/more\s+than/gi,       "__gt__ "],
  [/fewer\s+than/gi,      "__lt__ "],
  // ── Equality ──────────────────────────────────────────────────────────
  [/not\s+equals?/gi,     "__neq__ "],
  [/different\s+from/gi,  "__neq__ "],
  [/is\s+not/gi,          "__neq__ "],
  // ── String operators ──────────────────────────────────────────────────
  [/starts?\s+with/gi,           "__startswith__ "],
  [/begins?\s+with/gi,           "__startswith__ "],
  [/ends?\s+with/gi,             "__endswith__ "],
  [/does\s+not\s+contain/gi,     "__notcontains__ "],
  [/doesn'?t\s+contain/gi,       "__notcontains__ "],
  [/not\s+contains?/gi,          "__notcontains__ "],
  [/similar\s+to/gi,             "__contains__ "],
  // ── List operators (negative before positive) ──────────────────────────
  [/not\s+one\s+of/gi,    "__notoneof__ "],
  [/not\s+any\s+of/gi,    "__notoneof__ "],
  [/none\s+of/gi,         "__notoneof__ "],
  [/not\s+in\b/gi,        "__notoneof__ "],
  [/one\s+of/gi,          "__oneof__ "],
  [/any\s+of/gi,          "__oneof__ "],
  [/\bamong\b/gi,         "__oneof__ "],
  [/\bwithin\b/gi,        "__oneof__ "],

  // ── Date relative spans ────────────────────────────────────────────────
  [/this\s+week/gi,   "__date_this_week__"],
  [/last\s+week/gi,   "__date_last_week__"],
  [/next\s+week/gi,   "__date_next_week__"],
  [/this\s+month/gi,  "__date_this_month__"],
  [/last\s+month/gi,  "__date_last_month__"],
  [/next\s+month/gi,  "__date_next_month__"],
  [/this\s+year/gi,   "__date_this_year__"],
  [/last\s+year/gi,   "__date_last_year__"],
  [/next\s+year/gi,   "__date_next_year__"],
  // "in N units"  — future relative (before "N units ago" to avoid collision)
  [/\bin\s+(\d+)\s+days?\b/gi,    (_m: string, n: string) => `__date_in_${n}d__`],
  [/\bin\s+(\d+)\s+weeks?\b/gi,   (_m: string, n: string) => `__date_in_${n}w__`],
  [/\bin\s+(\d+)\s+months?\b/gi,  (_m: string, n: string) => `__date_in_${n}mo__`],
  [/\bin\s+(\d+)\s+years?\b/gi,   (_m: string, n: string) => `__date_in_${n}y__`],
  // "N units ago"  — past relative
  [/\b(\d+)\s+days?\s+ago\b/gi,   (_m: string, n: string) => `__date_${n}d_ago__`],
  [/\b(\d+)\s+weeks?\s+ago\b/gi,  (_m: string, n: string) => `__date_${n}w_ago__`],
  [/\b(\d+)\s+months?\s+ago\b/gi, (_m: string, n: string) => `__date_${n}mo_ago__`],
  [/\b(\d+)\s+years?\s+ago\b/gi,  (_m: string, n: string) => `__date_${n}y_ago__`],
];

/** Replace recognised multi-word phrases with single normalised tokens. */
export function preprocess(input: string): string {
  let s = input;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    s = s.replace(pattern as RegExp, replacement as string);
  }
  return s.trim();
}

// ---------------------------------------------------------------------------
// Operator synonym map
// ---------------------------------------------------------------------------

import type { AnyOperator } from "../types";

const OP_MAP: Record<string, AnyOperator> = {
  // Pre-processed __tokens__
  __gte__:          ">=",
  __lte__:          "<=",
  __gt__:           ">",
  __lt__:           "<",
  __neq__:          "!",
  __startswith__:   "<*",
  __endswith__:     ">*",
  __notcontains__:  "!*",
  __contains__:     "*",
  __oneof__:        "in",
  __notoneof__:     "!",
  // Symbol operators
  ">=": ">=", "<=": "<=", ">": ">", "<": "<",
  "!=": "!",  "!":  "!",  "=": "=",
  "<*": "<*", ">*": ">*", "!*": "!*", "*": "*",
  "in": "in",
  // Single-word English
  is: "=",  are: "=",  was: "=",  were: "=",
  equals: "=", matches: "=", exactly: "=",
  not: "!", excluding: "!", except: "!",
  contains: "*", includes: "*", has: "*", like: "*",
  excludes: "!*", prefix: "<*", suffix: ">*",
  over: ">", above: ">", after: ">", exceeds: ">",
  under: "<", below: "<", before: "<",
  min: ">=", minimum: ">=", max: "<=", maximum: "<=",
  among: "in", within: "in",
};

/** Resolve a raw operator token (symbol or English word) to a canonical operator. */
export function resolveOp(raw: string): AnyOperator | undefined {
  return OP_MAP[raw.toLowerCase().trim()];
}

// ---------------------------------------------------------------------------
// Date phrase resolution (de-tokenises __date_*__ tokens back to ISO strings)
// ---------------------------------------------------------------------------

export type DateRange = { from: string; to?: string };

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), diff));
}
function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  return endOfDay(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6));
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}
function endOfYear(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), 11, 31));
}

/**
 * Resolve a `__date_*__` token (or plain keyword like "today") to an ISO date range.
 * Returns undefined for unrecognised tokens.
 */
export function resolveDateToken(token: string, now = new Date()): DateRange | undefined {
  const t = token.toLowerCase().trim();

  switch (t) {
    case "today":
      return { from: isoDate(startOfDay(now)), to: isoDate(endOfDay(now)) };
    case "yesterday": {
      const d = addDays(now, -1);
      return { from: isoDate(startOfDay(d)), to: isoDate(endOfDay(d)) };
    }
    case "tomorrow": {
      const d = addDays(now, 1);
      return { from: isoDate(startOfDay(d)), to: isoDate(endOfDay(d)) };
    }
    case "now":
      return { from: now.toISOString() };
    case "__date_this_week__":
      return { from: isoDate(startOfWeek(now)), to: isoDate(endOfWeek(now)) };
    case "__date_last_week__": {
      const s = startOfWeek(addDays(now, -7));
      return { from: isoDate(s), to: isoDate(endOfWeek(s)) };
    }
    case "__date_next_week__": {
      const s = startOfWeek(addDays(now, 7));
      return { from: isoDate(s), to: isoDate(endOfWeek(s)) };
    }
    case "__date_this_month__":
      return { from: isoDate(startOfMonth(now)), to: isoDate(endOfMonth(now)) };
    case "__date_last_month__": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: isoDate(startOfMonth(d)), to: isoDate(endOfMonth(d)) };
    }
    case "__date_next_month__": {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { from: isoDate(startOfMonth(d)), to: isoDate(endOfMonth(d)) };
    }
    case "__date_this_year__":
      return { from: isoDate(startOfYear(now)), to: isoDate(endOfYear(now)) };
    case "__date_last_year__": {
      const d = new Date(now.getFullYear() - 1, 0, 1);
      return { from: isoDate(startOfYear(d)), to: isoDate(endOfYear(d)) };
    }
    case "__date_next_year__": {
      const d = new Date(now.getFullYear() + 1, 0, 1);
      return { from: isoDate(startOfYear(d)), to: isoDate(endOfYear(d)) };
    }
  }

  // Dynamic tokens: __date_Nd_ago__, __date_in_Nmo__, etc.
  const m = t.match(/^__date_(?:in_)?(\d+)(d|w|mo|y)(_ago)?__$/);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const sign = m[3] ? -1 : 1; // _ago = past
    let target: Date;
    switch (unit) {
      case "d":  target = addDays(now, sign * n); break;
      case "w":  target = addDays(now, sign * n * 7); break;
      case "mo": target = new Date(now.getFullYear(), now.getMonth() + sign * n, now.getDate()); break;
      case "y":  target = new Date(now.getFullYear() + sign * n, now.getMonth(), now.getDate()); break;
      default:   target = now;
    }
    return { from: isoDate(target) };
  }

  return undefined;
}
