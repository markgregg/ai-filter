/**
 * nlpResolver — extensible natural-language → FilterPill resolver.
 *
 * Converts a raw text fragment (e.g. the LLM response line, or direct user
 * input) into a structured FilterPill without needing exact field names or
 * symbol operators.
 *
 * Extension points
 * ----------------
 * - `valueResolvers`  — custom per-field (or global) value parsers
 * - Fields carry `label?` so multi-word fields can be matched by any word
 * - All operator aliases are table-driven so new ones can be added easily
 */

import { applyDateFormat, makeId } from "./parser";
import type {
  AnyOperator,
  FieldDefinition,
  FilterPill,
  ListPill,
  RangePill,
  ValuePill,
} from "./types";
import { defaultOperatorForType, operatorsForField } from "./operators";

// ---------------------------------------------------------------------------
// Operator alias table
// ---------------------------------------------------------------------------

/** Maps every recognised text alias to a canonical symbol operator. */
const OPERATOR_ALIASES: Array<{ patterns: RegExp; op: AnyOperator }> = [
  // Comparison — longer/more specific patterns first to avoid partial matches
  { patterns: /^(greater than or equals?( to)?|>=|at least|no less than|min(imum)?)$/i,    op: ">=" },
  { patterns: /^(less than or equals?( to)?|<=|at most|no more than|max(imum)?)$/i,        op: "<=" },
  { patterns: /^(greater than|>|more than|over|above|after|exceeds?)$/i,                    op: ">"  },
  { patterns: /^(less than|<|fewer than|under|below|before)$/i,                             op: "<"  },
  // Negative list — must be checked BEFORE single "not" to avoid misclassifying
  { patterns: /^(not one of|not in|none of|not any of)$/i,                                  op: "!"  },
  { patterns: /^(not equals?|!=|!|is not|not|different from|except|excluding)$/i,           op: "!"  },
  { patterns: /^(equals?|==|=|is|are|was|were|exactly|matches?)$/i,                         op: "="  },
  // String operators
  { patterns: /^(starts? with|begins? with|<\*|prefix)$/i,                                  op: "<*" },
  { patterns: /^(ends? with|>\*|suffix)$/i,                                                 op: ">*" },
  { patterns: /^(not contains?|doesn't contain|does not contain|!\*|excludes?)$/i,          op: "!*" },
  { patterns: /^(contains?|\*|includes?|has|like|similar to)$/i,                            op: "*"  },
  // List — positive
  { patterns: /^(in|one of|any of|among|within)$/i,                                         op: "in" },
];

/**
 * Resolve a raw operator string (symbol or text) to a canonical operator.
 * Returns `undefined` if no alias matches.
 */
export function resolveOperatorAlias(raw: string): AnyOperator | undefined {
  const trimmed = raw.trim();
  for (const entry of OPERATOR_ALIASES) {
    if (entry.patterns.test(trimmed)) return entry.op;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Date/time natural-language resolver
// ---------------------------------------------------------------------------

export type DateResolution = {
  /** ISO date string (yyyy-MM-dd) or ISO datetime string */
  value: string;
  /** When present, the user implied a range (e.g. "this week") */
  rangeEnd?: string;
};

function isoDate(d: Date): string {
  return applyDateFormat(d, "yyyy-MM-dd");
}

function isoDatetime(d: Date): string {
  return applyDateFormat(d, "yyyy-MM-dd HH:mm:ss");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return startOfDay(new Date(d.setDate(diff)));
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(new Date(d));
  return endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
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

function startOfQuarter(d: Date): Date {
  const startMonth = Math.floor(d.getMonth() / 3) * 3;
  return startOfDay(new Date(d.getFullYear(), startMonth, 1));
}

function endOfQuarter(d: Date): Date {
  const start = startOfQuarter(d);
  return endOfDay(new Date(start.getFullYear(), start.getMonth() + 3, 0));
}

function startOfSprint(d: Date): Date {
  // 2-week sprint anchored to current week's Monday.
  return startOfWeek(new Date(d));
}

function endOfSprint(d: Date): Date {
  const start = startOfSprint(d);
  return endOfDay(addDays(start, 13));
}

function isWeekend(day: number): boolean {
  return day === 0 || day === 6;
}

function nextBusinessDay(d: Date): Date {
  const out = addDays(d, 1);
  while (isWeekend(out.getDay())) {
    out.setDate(out.getDate() + 1);
  }
  return out;
}

function previousBusinessDay(d: Date): Date {
  const out = addDays(d, -1);
  while (isWeekend(out.getDay())) {
    out.setDate(out.getDate() - 1);
  }
  return out;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function nextWeekday(d: Date, targetDay: number, includeToday = false): Date {
  const out = startOfDay(new Date(d));
  const current = out.getDay();
  let delta = (targetDay - current + 7) % 7;
  if (delta === 0 && !includeToday) delta = 7;
  return addDays(out, delta);
}

/** Add n units to date d (signed — negative = subtract). */
function addUnit(d: Date, n: number, unit: string): Date {
  switch (unit) {
    case "minute": return new Date(d.getTime() + n * 60_000);
    case "hour":   return new Date(d.getTime() + n * 3_600_000);
    case "day":    return addDays(d, n);
    case "week":   return addDays(d, n * 7);
    case "month":  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
    case "year":   return new Date(d.getFullYear() + n, d.getMonth(), d.getDate());
    default:       return d;
  }
}

/** "a" or "an" → 1, otherwise parse integer. */
function parseQuantity(s: string): number {
  return /^an?$/i.test(s) ? 1 : parseInt(s, 10);
}

/**
 * Attempt to resolve a natural-language date/time phrase.
 * Returns `undefined` if the phrase is not recognised.
 */
export function resolveDatePhrase(raw: string, forDatetime = false): DateResolution | undefined {
  const text = raw
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\btorrow\b/g, "tomorrow");
  const now = new Date();
  const fmt = forDatetime ? isoDatetime : isoDate;

  // Exact keywords
  const exact: Record<string, () => DateResolution> = {
    now:          () => ({ value: isoDatetime(now) }),
    today:        () => ({ value: fmt(startOfDay(now)), rangeEnd: fmt(endOfDay(now)) }),
    yesterday:    () => { const d = addDays(now, -1); return { value: fmt(startOfDay(d)), rangeEnd: fmt(endOfDay(d)) }; },
    tomorrow:     () => { const d = addDays(now, 1);  return { value: fmt(startOfDay(d)), rangeEnd: fmt(endOfDay(d)) }; },
    "this week":  () => ({ value: fmt(startOfWeek(new Date(now))), rangeEnd: fmt(endOfWeek(new Date(now))) }),
    "last week":  () => { const s = startOfWeek(addDays(now, -7)); return { value: fmt(s), rangeEnd: fmt(endOfWeek(new Date(s))) }; },
    "next week":  () => { const s = startOfWeek(addDays(now, 7));  return { value: fmt(s), rangeEnd: fmt(endOfWeek(new Date(s))) }; },
    "this month": () => ({ value: fmt(startOfMonth(now)), rangeEnd: fmt(endOfMonth(now)) }),
    "last month": () => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { value: fmt(startOfMonth(d)), rangeEnd: fmt(endOfMonth(d)) }; },
    "next month": () => { const d = new Date(now.getFullYear(), now.getMonth() + 1, 1); return { value: fmt(startOfMonth(d)), rangeEnd: fmt(endOfMonth(d)) }; },
    "this year":  () => ({ value: fmt(startOfYear(now)), rangeEnd: fmt(endOfYear(now)) }),
    "last year":  () => { const d = new Date(now.getFullYear() - 1, 0, 1); return { value: fmt(startOfYear(d)), rangeEnd: fmt(endOfYear(d)) }; },
    "next year":  () => { const d = new Date(now.getFullYear() + 1, 0, 1); return { value: fmt(startOfYear(d)), rangeEnd: fmt(endOfYear(d)) }; },
    "this quarter": () => ({ value: fmt(startOfQuarter(now)), rangeEnd: fmt(endOfQuarter(now)) }),
    "last quarter": () => {
      const d = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return { value: fmt(startOfQuarter(d)), rangeEnd: fmt(endOfQuarter(d)) };
    },
    "next quarter": () => {
      const d = new Date(now.getFullYear(), now.getMonth() + 3, 1);
      return { value: fmt(startOfQuarter(d)), rangeEnd: fmt(endOfQuarter(d)) };
    },
    "this sprint": () => ({ value: fmt(startOfSprint(now)), rangeEnd: fmt(endOfSprint(now)) }),
    "last sprint": () => {
      const d = addDays(now, -14);
      return { value: fmt(startOfSprint(d)), rangeEnd: fmt(endOfSprint(d)) };
    },
    "next sprint": () => {
      const d = addDays(now, 14);
      return { value: fmt(startOfSprint(d)), rangeEnd: fmt(endOfSprint(d)) };
    },
    "next business day": () => {
      const d = nextBusinessDay(now);
      return { value: fmt(startOfDay(d)), rangeEnd: fmt(endOfDay(d)) };
    },
    "previous business day": () => {
      const d = previousBusinessDay(now);
      return { value: fmt(startOfDay(d)), rangeEnd: fmt(endOfDay(d)) };
    },
    "last business day": () => {
      const d = previousBusinessDay(now);
      return { value: fmt(startOfDay(d)), rangeEnd: fmt(endOfDay(d)) };
    },
  };

  if (exact[text]) return exact[text]();

  const weekdays: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const nextWeekdayMatch = text.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
  if (nextWeekdayMatch) {
    const target = weekdays[nextWeekdayMatch[1].toLowerCase()];
    const d = nextWeekday(now, target, false);
    return { value: fmt(startOfDay(d)), rangeEnd: fmt(endOfDay(d)) };
  }

  const bareWeekdayMatch = text.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
  if (bareWeekdayMatch) {
    const target = weekdays[bareWeekdayMatch[1].toLowerCase()];
    const d = nextWeekday(now, target, true);
    return { value: fmt(startOfDay(d)), rangeEnd: fmt(endOfDay(d)) };
  }

  if (/^(?:in\s+)?(?:a\s+)?fortnight$/i.test(text)) {
    const d = addDays(now, 14);
    return { value: fmt(startOfDay(d)), rangeEnd: fmt(endOfDay(d)) };
  }

  // ── Relative single-point ─────────────────────────────────────────────
  // "[in] (a|an|N) unit(s) [ago | from now]"
  // Covers: "in 2 weeks", "2 weeks ago", "in a year", "a week ago",
  //         "3 months from now", "a day from now", "in an hour", "5 minutes ago"
  const relativePoint = text.match(
    /^(?:(in)\s+)?(a|an|\d+)\s+(minute|hour|day|week|month|year)s?\s*(ago|from\s+now)?$/i,
  );
  if (relativePoint) {
    const n = parseQuantity(relativePoint[2]);
    const unit = relativePoint[3].toLowerCase();
    const suffix = (relativePoint[4] ?? "").toLowerCase();
    const past = suffix.startsWith("ago");
    const sign = past ? -1 : 1;
    return { value: fmt(addUnit(now, sign * n, unit)) };
  }

  // ── Relative range ────────────────────────────────────────────────────
  // "[(the)] (next|last|past) (a|an|N) unit(s)"
  // Covers: "next 2 weeks", "last 3 months", "past 30 days",
  //         "the next 6 months", "the last 2 years", "next a week"
  const relativeRange = text.match(
    /^(?:the\s+)?(next|last|past)\s+(a|an|\d+)\s+(minute|hour|day|week|month|year)s?$/i,
  );
  if (relativeRange) {
    const direction = relativeRange[1].toLowerCase();
    const n = parseQuantity(relativeRange[2]);
    const unit = relativeRange[3].toLowerCase();
    if (direction === "next") {
      const to = addUnit(now, n, unit);
      return {
        value:    fmt(forDatetime ? now : startOfDay(now)),
        rangeEnd: fmt(forDatetime ? to  : endOfDay(to)),
      };
    } else {
      // last / past
      const from = addUnit(now, -n, unit);
      return {
        value:    fmt(forDatetime ? from : startOfDay(from)),
        rangeEnd: fmt(forDatetime ? now  : endOfDay(now)),
      };
    }
  }

  // Try native Date.parse as a last resort (handles "2024-01-01", "Jan 2024", etc.)
  const parsed = Date.parse(text);
  if (!isNaN(parsed)) {
    return { value: fmt(new Date(parsed)) };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Value resolver extension point
// ---------------------------------------------------------------------------

export type ValueResolverContext = {
  field: FieldDefinition;
  rawValue: string;
  /** Operator that was determined for this expression (symbol form). */
  operator: AnyOperator;
};

/**
 * A custom value resolver.
 *
 * - `fieldName`: when set, only invoked for that specific field.
 *               When omitted, invoked for all fields after built-ins.
 * - `resolve`:   return the parsed value, or `undefined` to fall through to
 *               the next resolver.
 */
export type ValueResolver = {
  fieldName?: string;
  resolve: (ctx: ValueResolverContext) => unknown | undefined;
};

// ---------------------------------------------------------------------------
// Field matching
// ---------------------------------------------------------------------------

/**
 * Score how well `token` matches `field`.
 * Higher = better match.  0 = no match.
 *
 * Matching strategy (descending priority):
 *  5 — exact field name (case-insensitive)
 *  4 — exact label match
 *  3 — field name starts with token
 *  2 — label starts with token
 *  1 — token is a word within the field name or label
 *  0 — no match
 */
function fieldMatchScore(field: FieldDefinition, token: string): number {
  const t = token.toLowerCase();
  const name = field.name.toLowerCase();
  const label = (field.label ?? "").toLowerCase();

  if (name === t) return 5;
  if (label && label === t) return 4;
  if (name.startsWith(t)) return 3;
  if (label && label.startsWith(t)) return 2;
  // word boundary match — token must be a full word within name or label
  const nameParts = name.split(/[\s_-]+/);
  const labelParts = label.split(/[\s_-]+/);
  if (nameParts.includes(t) || labelParts.includes(t)) return 1;
  return 0;
}

/**
 * Given a raw token, return the best-matching field.
 * When scores tie, the field with the lower `precedence` value wins.
 */
function matchField(
  token: string,
  fields: FieldDefinition[],
): FieldDefinition | undefined {
  let best: FieldDefinition | undefined;
  let bestScore = 0;

  for (const field of fields) {
    const score = fieldMatchScore(field, token);
    if (score === 0) continue;
    if (
      score > bestScore ||
      (score === bestScore && best !== undefined && field.precedence < best.precedence)
    ) {
      best = field;
      bestScore = score;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Tokeniser — splits an expression into [fieldToken, operatorToken, valueToken]
// ---------------------------------------------------------------------------

/** All multi-word operator phrases we need to detect before splitting by space */
const MULTI_WORD_OPS = [
  "greater than or equal to",
  "greater than or equal",
  "less than or equal to",
  "less than or equal",
  "does not contain",
  "doesn't contain",
  "not contains",
  "not one of",
  "not in",
  "none of",
  "not any of",
  "starts with",
  "begins with",
  "ends with",
  "one of",
  "any of",
  "is not",
  "not equal",
  "no less than",
  "no more than",
  "at least",
  "at most",
  "greater than",
  "less than",
  "more than",
  "fewer than",
  "similar to",
  "different from",
];

type Tokens = {
  fieldToken: string;
  operatorToken: string;
  valueToken: string;
};

// Matches inputs that begin with a symbol operator and have no field prefix.
// e.g. "> 10", "!= Done", "<* AP", "* bug"
// Order matters: longer ops before shorter to avoid partial matches.
const LEADING_SYM_RE =
  /^(>=|<=|!=|!\*|<\*|>\*|!(?!=)|>|<|=(?!=)|\*)\s+(.+)$/;

function tokenise(line: string): Tokens | undefined {
  const text = line.trim();
  if (!text) return undefined;

  // Leading symbol operator — no field given: "> 10", "= Done", "!* spam"
  const leadingSymMatch = text.match(LEADING_SYM_RE);
  if (leadingSymMatch) {
    return {
      fieldToken:    "",
      operatorToken: leadingSymMatch[1].trim(),
      valueToken:    leadingSymMatch[2].trim(),
    };
  }

  // Try multi-word operator phrases first
  for (const phrase of MULTI_WORD_OPS) {
    const re = new RegExp(`^(.+?)\\s+(${phrase})\\s+(.+)$`, "i");
    const m = text.match(re);
    if (m) {
      return { fieldToken: m[1].trim(), operatorToken: m[2].trim(), valueToken: m[3].trim() };
    }
  }

  // Try single-word / symbol operator (split on first operator-like token)
  // Pattern: <field> <op> <value>
  const symbolOpRe = /^(.+?)\s*(>=|<=|!=|!(?!=)|>|<|=(?!=)|\*|!?\*|<\*|>\*)\s+(.+)$/;
  const symMatch = text.match(symbolOpRe);
  if (symMatch) {
    return {
      fieldToken: symMatch[1].trim(),
      operatorToken: symMatch[2].trim(),
      valueToken: symMatch[3].trim(),
    };
  }

  // Try word-split: field opWord value
  const parts = text.split(/\s+/);
  if (parts.length >= 3) {
    return {
      fieldToken: parts[0],
      operatorToken: parts[1],
      valueToken: parts.slice(2).join(" "),
    };
  }

  // Two tokens: field + value (implicit operator)
  if (parts.length === 2) {
    return { fieldToken: parts[0], operatorToken: "", valueToken: parts[1] };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Word-to-number conversion
// ---------------------------------------------------------------------------

const NUM_WORD_MAP: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // aliases
  couple: 2, dozen: 12, half: 0.5,
  oh: 0, // spoken digit "oh"
};

const SCALE_MAP: Record<string, number> = {
  hundred: 100,
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000,
};

/** Parse a non-negative integer expressed in English words.
 *  Returns `undefined` for unrecognised input. */
function parseWordInt(words: string[]): number | undefined {
  let total = 0;
  let current = 0;
  for (const w of words) {
    if (w === "and" || w === "a" || w === "an") continue;
    const scale = SCALE_MAP[w];
    if (scale !== undefined) {
      if (w === "hundred") {
        current = (current === 0 ? 1 : current) * 100;
      } else {
        current = current === 0 ? 1 : current;
        total += current * scale;
        current = 0;
      }
      continue;
    }
    const v = NUM_WORD_MAP[w];
    if (v === undefined) return undefined;
    current += v;
  }
  return total + current;
}

/**
 * Convert an English number phrase to a JS number.
 * Handles negatives, decimals ("point"), and common aliases.
 * Returns `undefined` when the string is not recognised as a number phrase.
 *
 * Examples:
 *   "five"                       → 5
 *   "twenty-two"                 → 22
 *   "one hundred fifty"          → 150
 *   "three thousand"             → 3000
 *   "two million four hundred thousand" → 2_400_000
 *   "minus seven"                → -7
 *   "three point five"           → 3.5
 *   "half"                       → 0.5
 *   "a dozen"                    → 12
 *   "3 million"  (mixed)         → 3_000_000
 */
export function wordsToNumber(raw: string): number | undefined {
  const text = raw.trim().toLowerCase().replace(/-/g, " ");
  if (!text) return undefined;

  // Negative prefix
  let sign = 1;
  let rest = text;
  if (/^(minus|negative)\s+/.test(rest)) {
    sign = -1;
    rest = rest.replace(/^(minus|negative)\s+/, "");
  }

  // Decimal split on "point"
  const pointIdx = rest.indexOf(" point ");
  if (pointIdx !== -1) {
    const intWords = rest.slice(0, pointIdx).trim().split(/\s+/);
    const decWords = rest.slice(pointIdx + 7).trim().split(/\s+/);
    const intVal = parseWordInt(intWords);
    if (intVal === undefined) return undefined;
    // Convert each word after "point" to a single digit
    const decDigits = decWords.map((w) => {
      const d = NUM_WORD_MAP[w];
      return d !== undefined && d >= 0 && d <= 9 ? String(d) : undefined;
    });
    if (decDigits.some((d) => d === undefined)) return undefined;
    const decVal = parseFloat(`0.${decDigits.join("")}`);
    return sign * (intVal + decVal);
  }

  // Mixed: allow digit tokens alongside word tokens ("3 million", "2 thousand")
  const words = rest.split(/\s+/).map((w) => {
    if (/^\d+$/.test(w)) {
      const n = parseInt(w, 10);
      return `__digit_${n}`;
    }
    return w;
  });

  let total = 0;
  let current = 0;
  for (const w of words) {
    if (w === "and" || w === "a" || w === "an") continue;
    if (w.startsWith("__digit_")) {
      current += parseInt(w.slice(8), 10);
      continue;
    }
    const scale = SCALE_MAP[w];
    if (scale !== undefined) {
      if (w === "hundred") {
        current = (current === 0 ? 1 : current) * 100;
      } else {
        current = current === 0 ? 1 : current;
        total += current * scale;
        current = 0;
      }
      continue;
    }
    const v = NUM_WORD_MAP[w];
    if (v === undefined) return undefined;
    current += v;
  }
  const result = total + current;
  return sign * result;
}

// ---------------------------------------------------------------------------
// Core value resolver (built-in)
// ---------------------------------------------------------------------------

function resolveBuiltInValue(field: FieldDefinition, raw: string, _op: AnyOperator): unknown {
  const text = raw.trim();

  switch (field.type) {
    case "integer": {
      const n = Number.parseInt(text, 10);
      if (!Number.isNaN(n)) return n;
      const w = wordsToNumber(text);
      if (w !== undefined) return Math.round(w);
      return text; // preserved as string → pill will be marked invalid
    }
    case "float": {
      const f = Number.parseFloat(text);
      if (!Number.isNaN(f)) return f;
      const w = wordsToNumber(text);
      if (w !== undefined) return w;
      return text; // preserved as string → pill will be marked invalid
    }
    case "boolean":
      return /^(true|1|yes|on)$/i.test(text);
    case "date": {
      const resolved = resolveDatePhrase(text, false);
      if (resolved) return resolved.value;
      const d = new Date(text);
      return isNaN(d.getTime()) ? text : isoDate(d);
    }
    case "datetime": {
      const resolved = resolveDatePhrase(text, true);
      if (resolved) return resolved.value;
      const d = new Date(text);
      return isNaN(d.getTime()) ? text : isoDatetime(d);
    }
    case "set":
    case "string":
    default:
      if (field.translate) return field.translate(text);
      return text;
  }
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

export type NlpResolveOptions = {
  /**
   * Custom value resolvers tried in order before the built-in resolver.
   * First resolver to return a non-undefined value wins.
   */
  valueResolvers?: ValueResolver[];
  /**
   * When no field token matches, fall back to the field with the lowest
   * `precedence` value instead of returning undefined.
   * Default: true.
   */
  fallbackToHighestPrecedence?: boolean;
  /**
   * Pre-loaded set values keyed by field name. Used for value-only inference
   * when the field's `setValues` is an async function.
   * e.g. { state: ["New", "Done", "Blocked"] }
   */
  setValuesByField?: Record<string, string[]>;
};

/**
 * Try to infer a field purely from a value string.
 * Checks set fields (known values) and boolean fields.
 * Returns the highest-precedence field whose known values include `raw`.
 */
function inferFieldFromValue(
  raw: string,
  fields: FieldDefinition[],
  setValuesByField: Record<string, string[]> = {},
): FieldDefinition | undefined {
  const v = raw.toLowerCase().trim();
  for (const field of fields) {
    if (field.type === "set") {
      const known: string[] = Array.isArray(field.setValues)
        ? (field.setValues as string[])
        : (setValuesByField[field.name] ?? []);
      if (known.some((sv) => sv.toLowerCase() === v)) return field;
    }
    if (field.type === "boolean" && /^(true|false|yes|no|1|0|on|off)$/i.test(v)) {
      return field;
    }
  }
  return undefined;
}

/**
 * Resolve a natural-language filter expression (a single line) into a
 * FilterPill.
 *
 * Examples of inputs it handles:
 *   "cost > 10"
 *   "cost greater than 10"
 *   "status is active"
 *   "created last week"
 *   "name contains smith"
 *   "price between 10 and 50"   → RangePill
 *   "category one of A, B, C"   → ListPill
 *
 * @param line     Raw text expression (single filter clause)
 * @param fields   Field definitions for the dataset
 * @param options  Extension options (custom value resolvers, fallback policy)
 */
export function resolveNlpExpression(
  line: string,
  fields: FieldDefinition[],
  options: NlpResolveOptions = {},
): FilterPill | undefined {
  if (!fields.length) return undefined;

  // Handle logical tokens so AND/OR/brackets pass through cleanly.
  const upper = line.trim().toUpperCase();
  if (upper === "AND") return { id: makeId(), kind: "and" };
  if (upper === "OR")  return { id: makeId(), kind: "or" };
  if (upper === "(")   return { id: makeId(), kind: "open-bracket" };
  if (upper === ")")   return { id: makeId(), kind: "close-bracket" };

  const { valueResolvers = [], fallbackToHighestPrecedence = true, setValuesByField = {} } = options;

  // Sort a stable copy by precedence so tie-breaking is deterministic
  const sortedFields = [...fields].sort((a, b) => a.precedence - b.precedence);

  // Check the WHOLE line as a potential set / boolean value BEFORE tokenising.
  // This correctly handles:
  //   "Done"        → status = Done    (single set value)
  //   "In Progress" → status = In Progress  (multi-word set value — would
  //                   otherwise tokenise as fieldToken="In", valueToken="Progress")
  //   "true"        → active = true   (boolean value)
  const wholeLineField = inferFieldFromValue(line.trim(), sortedFields, setValuesByField);
  if (wholeLineField) {
    const value = resolveValue(wholeLineField, line.trim(), "=", valueResolvers);
    return { id: makeId(), kind: "value", fieldName: wholeLineField.name, operator: "=", value };
  }

  const tokens = tokenise(line);
  if (!tokens) {
    // Single token that is not a recognised set/boolean value.
    // Fall back to the highest-precedence field with its default operator.
    // e.g. "hello" → title * "hello"  (when title has the lowest precedence number)
    if (fallbackToHighestPrecedence && sortedFields.length > 0) {
      const field = sortedFields[0];
      const op = defaultOperatorForType(field.type);
      const value = resolveValue(field, line.trim(), op, valueResolvers);
      return { id: makeId(), kind: "value", fieldName: field.name, operator: op, value };
    }
    return undefined;
  }

  const { fieldToken, operatorToken, valueToken } = tokens;

  // Operator-aware field selection: when the field token doesn't match any
  // known field by name, prefer a field that actually supports the requested
  // operator rather than blindly falling back to sortedFields[0].
  // e.g. "> 10" → count (integer) rather than title (string, which has no >).
  const matchedField = (() => {
    if (fieldToken) {
      const byName = matchField(fieldToken, sortedFields);
      if (byName) return byName;
    }
    if (!fallbackToHighestPrecedence) return undefined;
    const opHint = resolveOperatorAlias(operatorToken);
    if (opHint) {
      const compatible = sortedFields.find((f) => operatorsForField(f).includes(opHint));
      if (compatible) return compatible;
    }
    return sortedFields[0];
  })();
  if (!matchedField) return undefined;

  // Resolve operator
  const resolvedOp: AnyOperator =
    resolveOperatorAlias(operatorToken) ??
    defaultOperatorForType(matchedField.type);

  const allowedOps = operatorsForField(matchedField);
  const finalOp: AnyOperator = allowedOps.includes(resolvedOp)
    ? resolvedOp
    : allowedOps[0];

  // ── Range detection ────────────────────────────────────────────────────
  // Supported formats:
  //   1. "field from X to Y"     — explicit 'from' keyword
  //   2. "field between X and Y" — explicit 'between' keyword
  //   3. "field X to Y"          — implicit: value in operator slot, "to Y" in value slot
  //                               (produced by the AI round-trip serializer and also a
  //                               natural short form that parseInputToPill already accepts)
  //   4. "from X to Y"           — fieldless; highest-precedence range-capable field
  //   5. "between X and Y"       — fieldless; highest-precedence range-capable field
  // Only produced when the field's allowedOps include >, <, >= or <=.
  const isRangeField =
    allowedOps.some((op) => ([">", "<", ">=", "<="] as AnyOperator[]).includes(op));
  const isFromOp    = /^from$/i.test(operatorToken);
  const isBetweenOp = /^between$/i.test(operatorToken);

  if (isRangeField) {
    // Format 1: "field from X to Y" — operatorToken="from", valueToken="X to Y"
    if (isFromOp) {
      const toMatch = valueToken.match(/^(.+?)\s+to\s+(.+)$/i);
      if (toMatch) {
        const from = resolveRangeBoundaryValue(matchedField, toMatch[1].trim(), "start", valueResolvers);
        const to   = resolveRangeBoundaryValue(matchedField, toMatch[2].trim(), "end", valueResolvers);
        return { id: makeId(), kind: "range", fieldName: matchedField.name, from, to };
      }
    }

    // Format 2: "field between X and Y" — operatorToken="between", valueToken="X and Y"
    if (isBetweenOp) {
      const andMatch = valueToken.match(/^(.+?)\s+and\s+(.+)$/i);
      if (andMatch) {
        const from = resolveRangeBoundaryValue(matchedField, andMatch[1].trim(), "start", valueResolvers);
        const to   = resolveRangeBoundaryValue(matchedField, andMatch[2].trim(), "end", valueResolvers);
        return { id: makeId(), kind: "range", fieldName: matchedField.name, from, to };
      }
    }

    // Format 3: "field X to Y" — operatorToken holds the from-value, valueToken is "to Y".
    // This is the form produced by the AI round-trip serializer ("cost 1 to 10") and is
    // also a natural short-hand that the base parser already understands.
    // Guard: the "operator" slot must NOT be a recognised operator — otherwise
    // "status in to something" would be misread.
    if (resolveOperatorAlias(operatorToken) === undefined && !isFromOp && !isBetweenOp) {
      const toMatch = valueToken.match(/^to\s+(.+)$/i);
      if (toMatch) {
        const from = resolveRangeBoundaryValue(matchedField, operatorToken, "start", valueResolvers);
        const to   = resolveRangeBoundaryValue(matchedField, toMatch[1].trim(), "end", valueResolvers);
        return { id: makeId(), kind: "range", fieldName: matchedField.name, from, to };
      }
    }
  }

  // Formats 3 & 4: fieldless — "from X to Y" / "between X and Y"
  // The tokenizer places the keyword in fieldToken when no real field name precedes it:
  //   "from X to Y"     → fieldToken="from",    operatorToken=X, valueToken="to Y"
  //   "between X and Y" → fieldToken="between",  operatorToken=X, valueToken="and Y"
  if (/^(from|between)$/i.test(fieldToken) && resolveOperatorAlias(operatorToken) === undefined) {
    const boundaryEndRaw = /^to\s+(.+)$/i.test(valueToken)
      ? valueToken.replace(/^to\s+/i, "")
      : valueToken.replace(/^and\s+/i, "");
    const isDateLikeStart = resolveDatePhrase(operatorToken, false) !== undefined;
    const isDateLikeEnd = resolveDatePhrase(boundaryEndRaw, false) !== undefined;

    const fieldlessRangeField = sortedFields.find((f) => {
      if (isDateLikeStart && isDateLikeEnd && (f.type === "date" || f.type === "datetime")) {
        return true;
      }
      const ops = operatorsForField(f);
      return ops.some((op) => ([">", "<", ">=", "<="] as AnyOperator[]).includes(op));
    });
    if (fieldlessRangeField) {
      if (/^from$/i.test(fieldToken)) {
        const toMatch = valueToken.match(/^to\s+(.+)$/i);
        if (toMatch) {
          const from = resolveRangeBoundaryValue(fieldlessRangeField, operatorToken, "start", valueResolvers);
          const to   = resolveRangeBoundaryValue(fieldlessRangeField, toMatch[1].trim(), "end", valueResolvers);
          return { id: makeId(), kind: "range", fieldName: fieldlessRangeField.name, from, to };
        }
      }
      if (/^between$/i.test(fieldToken)) {
        const andMatch = valueToken.match(/^and\s+(.+)$/i);
        if (andMatch) {
          const from = resolveRangeBoundaryValue(fieldlessRangeField, operatorToken, "start", valueResolvers);
          const to   = resolveRangeBoundaryValue(fieldlessRangeField, andMatch[1].trim(), "end", valueResolvers);
          return { id: makeId(), kind: "range", fieldName: fieldlessRangeField.name, from, to };
        }
      }
    }
  }

  // ── Date phrases that imply a range ────────────────────────────────────
  // Only produce a RangePill when the user explicitly typed an operator
  // (e.g. "due = today" → range covering the whole day).
  // When no operator is given (e.g. "due tomorrow"), fall through to the
  // value-pill path which resolves the date phrase to its start-of-period
  // value — matching the intuitive reading "due is tomorrow's date".
  if (operatorToken && (matchedField.type === "date" || matchedField.type === "datetime")) {
    const dateRes = resolveDatePhrase(valueToken, matchedField.type === "datetime");
    if (dateRes?.rangeEnd) {
      const rangePill: RangePill = {
        id: makeId(),
        kind: "range",
        fieldName: matchedField.name,
        from: dateRes.value,
        to: dateRes.rangeEnd,
      };
      return rangePill;
    }
  }

  // ── Numeric-field phrase spanning the operator+value slots ─────────────
  // When the operator slot holds an unrecognised token, the user may have
  // written a multi-word number phrase that was split across slots, e.g.:
  //   "priority three hundred"  → op="three", value="hundred"   → 300
  //   "priority minus seven"    → op="minus", value="seven"     → -7
  //   "cost three point five"   → op="three", value="point five" → 3.5
  // Try wordsToNumber on the concatenated string before falling through.
  if (
    operatorToken !== "" &&
    resolveOperatorAlias(operatorToken) === undefined &&
    !isFromOp && !isBetweenOp &&
    (matchedField.type === "integer" || matchedField.type === "float")
  ) {
    const fullPhrase = `${operatorToken} ${valueToken}`.trim();
    const n = wordsToNumber(fullPhrase);
    if (n !== undefined) {
      const value = matchedField.type === "integer" ? Math.round(n) : n;
      return {
        id: makeId(),
        kind: "value",
        fieldName: matchedField.name,
        operator: finalOp,
        value,
      } satisfies ValuePill;
    }
  }

  // ── Date-field phrase spanning the operator+value slots ────────────────
  // When the operator slot doesn't hold a recognised operator, the user may
  // have written a multi-word date phrase split across slots, e.g.:
  //   "due next 2 weeks"  → fieldToken="due", op="next", value="2 weeks"
  //   "due last 3 months" → fieldToken="due", op="last", value="3 months"
  //   "due next week"     → fieldToken="due", op="next", value="week"
  // Try the concatenated string as a date phrase before falling through.
  if (
    operatorToken !== "" &&
    resolveOperatorAlias(operatorToken) === undefined &&
    !isFromOp && !isBetweenOp &&
    (matchedField.type === "date" || matchedField.type === "datetime")
  ) {
    const fullPhrase = `${operatorToken} ${valueToken}`.trim();
    const fullDateRes = resolveDatePhrase(fullPhrase, matchedField.type === "datetime");
    if (fullDateRes) {
      if (fullDateRes.rangeEnd) {
        return {
          id: makeId(),
          kind: "range",
          fieldName: matchedField.name,
          from: fullDateRes.value,
          to: fullDateRes.rangeEnd,
        } satisfies RangePill;
      }
      return {
        id: makeId(),
        kind: "value",
        fieldName: matchedField.name,
        operator: "=",
        value: fullDateRes.value,
      } satisfies ValuePill;
    }
  }

  // ── List detection ─────────────────────────────────────────────────────
  // Exact supported formats (explicit keyword required):
  //   Positive:  "field one of X, Y, Z"     → in [X, Y, Z]
  //              "field one of X or Y or Z"  → in [X, Y, Z]
  //              "field in X, Y, Z"          → in [X, Y, Z]
  //              "field in X or Y or Z"      → in [X, Y, Z]
  //   Negative:  "field not one of X, Y, Z" → ! [X, Y, Z]
  //              "field none of X, Y, Z"     → ! [X, Y, Z]
  // Only produced for fields whose operators include "in" (positive)
  // or "!" (negative).
  const isPositiveListOp = /^(one of|any of|in)$/i.test(operatorToken);
  const isNegativeListOp = /^(not one of|none of|not any of|not in)$/i.test(operatorToken);

  if ((isPositiveListOp && allowedOps.includes("in")) ||
      (isNegativeListOp && allowedOps.includes("!"))) {
    const listOp: AnyOperator = isNegativeListOp ? "!" : "in";
    const listParts = valueToken
      .split(/\s*,\s*|\s+or\s+/i)
      .map((p) => p.trim())
      .filter(Boolean);
    if (listParts.length > 0) {
      const values = listParts.map((p) => resolveValue(matchedField, p, listOp, valueResolvers));
      return {
        id: makeId(),
        kind: "list",
        fieldName: matchedField.name,
        operator: listOp,
        values,
      } satisfies ListPill;
    }
  }

  // Plain value pill
  const value = resolveValue(matchedField, valueToken, finalOp, valueResolvers);
  const valuePill: ValuePill = {
    id: makeId(),
    kind: "value",
    fieldName: matchedField.name,
    operator: finalOp,
    value,
  };
  if (!isValueValidForField(matchedField, value, setValuesByField)) {
    valuePill.invalid = true;
  }
  return valuePill;
}

/** Returns false when the resolved value clearly does not satisfy the field's type contract. */
function isValueValidForField(
  field: FieldDefinition,
  value: unknown,
  setValuesByField: Record<string, string[]>,
): boolean {
  switch (field.type) {
    case "integer":
      return typeof value === "number" && Number.isFinite(value);
    case "float":
      return typeof value === "number" && !Number.isNaN(value);
    case "boolean":
      return typeof value === "boolean";
    case "date":
    case "datetime":
      if (typeof value !== "string") return false;
      return !Number.isNaN(Date.parse(value));
    case "set": {
      if (typeof value !== "string") return false;
      const known: string[] = Array.isArray(field.setValues)
        ? (field.setValues as string[])
        : (setValuesByField[field.name] ?? []);
      // If we have no known values yet (async source not loaded), assume valid.
      if (known.length === 0) return true;
      return known.some((v) => v.toLowerCase() === (value as string).toLowerCase());
    }
    case "string":
    case "custom":
    default:
      return true;
  }
}

function resolveValue(
  field: FieldDefinition,
  raw: string,
  op: AnyOperator,
  valueResolvers: ValueResolver[],
): unknown {
  const ctx: ValueResolverContext = { field, rawValue: raw, operator: op };
  for (const resolver of valueResolvers) {
    if (resolver.fieldName && resolver.fieldName !== field.name) continue;
    const result = resolver.resolve(ctx);
    if (result !== undefined) return result;
  }
  return resolveBuiltInValue(field, raw, op);
}

function resolveRangeBoundaryValue(
  field: FieldDefinition,
  raw: string,
  edge: "start" | "end",
  valueResolvers: ValueResolver[],
): unknown {
  if (field.type === "date" || field.type === "datetime") {
    const dateRes = resolveDatePhrase(raw, field.type === "datetime");
    if (dateRes) {
      if (edge === "end" && dateRes.rangeEnd) return dateRes.rangeEnd;
      return dateRes.value;
    }
  }
  return resolveValue(field, raw, "=", valueResolvers);
}

// ---------------------------------------------------------------------------
// Multi-clause query resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a full natural-language query string into an array of FilterPills.
 *
 * Handles:
 * - Logical connectors: "and" / "or" between clauses
 * - Comma-separated clauses (treated as implicit AND)
 * - "between X and Y" — the inner "and" is NOT treated as a connector
 * - Bracket tokens: "(" / ")"
 *
 * Examples:
 *   "cost between 1 and 10 and state = Done"
 *   "priority > 3, state one of Blocked, New"
 *   "due from last week to today or state = Done"
 */
export function resolveNlpQuery(
  query: string,
  fields: FieldDefinition[],
  options: NlpResolveOptions = {},
): FilterPill[] {
  if (!query.trim()) return [];

  // Tokenise the query on AND, OR, and bracket characters so that:
  //   • brackets "(" ")" become standalone tokens
  //   • the "and" inside "between X and Y" is later re-merged (see loop below)
  //   • list expressions like "status in New,Done" are NOT split on comma
  const rawParts = query.split(/(\band\b|\bor\b|\(|\))/i).map((p) => p.trim()).filter(Boolean);
  const parts: string[] = [];
  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    // "between" clause whose "and" was split off: merge it back.
    if (
      /\bbetween\b/i.test(part) &&
      !/\band\b/i.test(part) &&
      i + 2 < rawParts.length &&
      /^and$/i.test(rawParts[i + 1])
    ) {
      parts.push(`${part} and ${rawParts[i + 2]}`);
      i += 2;
    } else {
      parts.push(part);
    }
  }

  const pills: FilterPill[] = [];
  for (const part of parts) {
    const upper = part.toUpperCase();
    if (upper === "AND" || upper === "OR" || upper === "(" || upper === ")") {
      const pill = resolveNlpExpression(part, fields, options);
      if (pill) pills.push(pill);
      continue;
    }
    // Comma-separated sub-clauses are implicitly ANDed — EXCEPT when the
    // clause is a list expression ("status in New,Done") where commas are
    // list-item separators, not clause separators.
    const isListClause = /\b(in|one\s+of|any\s+of|none\s+of|not\s+one\s+of|not\s+in|not\s+any\s+of)\b/i.test(part);
    const subClauses = isListClause
      ? [part]
      : part.split(/\s*,\s*/).map((c) => c.trim()).filter(Boolean);
    for (let j = 0; j < subClauses.length; j++) {
      if (j > 0) pills.push({ id: makeId(), kind: "and" });
      const pill = resolveNlpExpression(subClauses[j], fields, options);
      if (pill) pills.push(pill);
    }
  }
  return pills;
}
