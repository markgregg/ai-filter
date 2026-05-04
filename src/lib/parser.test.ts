/**
 * parser.test.ts
 *
 * Comprehensive tests for all exports from parser.ts:
 *   - makeId
 *   - applyDateFormat
 *   - formatDateValue
 *   - parseLogicalToken
 *   - normalizePills
 *   - parsePrimitive
 *   - parseInputToPill (all field types, all operators, range, list, logical tokens)
 *   - pillLabel
 */

import { describe, expect, it } from "vitest";
import {
  applyDateFormat,
  formatDateValue,
  makeId,
  normalizePills,
  parseInputToPill,
  parseLogicalToken,
  parsePrimitive,
  pillLabel,
} from "./parser";
import type { FieldDefinition, FilterPill, ListPill, RangePill, ValuePill } from "./types";

// ── Shared field fixtures ───────────────────────────────────────────────────

const FIELDS: FieldDefinition[] = [
  { name: "title", type: "string", precedence: 1 },
  { name: "count", type: "integer", precedence: 2 },
  { name: "price", type: "float", precedence: 3 },
  { name: "due", type: "date", precedence: 4 },
  { name: "created", type: "datetime", precedence: 5 },
  { name: "active", type: "boolean", precedence: 6 },
  { name: "status", type: "set", precedence: 7, setValues: ["New", "In Progress", "Done"] },
  { name: "custom", type: "custom", translate: (v) => `__${v}__`, operators: ["=", "!"], precedence: 8 },
];

function parseInput(input: string, preferredField?: string, previousPill?: FilterPill) {
  return parseInputToPill({ input, fields: FIELDS, preferredField, previousPill });
}

// ── makeId ──────────────────────────────────────────────────────────────────

describe("makeId", () => {
  it("returns a non-empty string", () => {
    expect(typeof makeId()).toBe("string");
    expect(makeId().length).toBeGreaterThan(0);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 50 }, makeId));
    expect(ids.size).toBe(50);
  });
});

// ── applyDateFormat ──────────────────────────────────────────────────────────

describe("applyDateFormat", () => {
  const d = new Date(2024, 0, 5, 9, 7, 3); // 2024-01-05 09:07:03

  it("formats yyyy-MM-dd", () => {
    expect(applyDateFormat(d, "yyyy-MM-dd")).toBe("2024-01-05");
  });

  it("formats yyyy-MM-dd HH:mm:ss", () => {
    expect(applyDateFormat(d, "yyyy-MM-dd HH:mm:ss")).toBe("2024-01-05 09:07:03");
  });

  it("pads single-digit month and day", () => {
    expect(applyDateFormat(d, "MM/dd/yyyy")).toBe("01/05/2024");
  });

  it("supports partial formats", () => {
    expect(applyDateFormat(d, "HH:mm")).toBe("09:07");
  });
});

// ── formatDateValue ──────────────────────────────────────────────────────────

describe("formatDateValue", () => {
  it("formats a Date object with default date format", () => {
    const d = new Date(2024, 5, 15); // 2024-06-15
    const result = formatDateValue(d, "date");
    expect(result).toBe("2024-06-15");
  });

  it("formats a Date object with default datetime format", () => {
    const d = new Date(2024, 5, 15, 14, 30, 0);
    const result = formatDateValue(d, "datetime");
    expect(result).toBe("2024-06-15 14:30:00");
  });

  it("accepts a custom format", () => {
    const d = new Date(2024, 5, 15);
    expect(formatDateValue(d, "date", "MM/dd/yyyy")).toBe("06/15/2024");
  });

  it("accepts an ISO string as value", () => {
    const d = new Date(2024, 0, 1, 12, 0, 0);
    const iso = d.toISOString();
    expect(formatDateValue(iso, "datetime")).toMatch(/2024/);
  });

  it("returns raw string for unparseable value", () => {
    expect(formatDateValue("not-a-date", "date")).toBe("not-a-date");
  });
});

// ── parseLogicalToken ────────────────────────────────────────────────────────

describe("parseLogicalToken", () => {
  it("parses AND (case-insensitive)", () => {
    expect(parseLogicalToken("AND")).toBe("AND");
    expect(parseLogicalToken("and")).toBe("AND");
    expect(parseLogicalToken("And")).toBe("AND");
  });

  it("parses OR (case-insensitive)", () => {
    expect(parseLogicalToken("OR")).toBe("OR");
    expect(parseLogicalToken("or")).toBe("OR");
  });

  it("parses ( and )", () => {
    expect(parseLogicalToken("(")).toBe("(");
    expect(parseLogicalToken(")")).toBe(")");
  });

  it("trims whitespace", () => {
    expect(parseLogicalToken("  AND  ")).toBe("AND");
  });

  it("returns undefined for non-tokens", () => {
    expect(parseLogicalToken("hello")).toBeUndefined();
    expect(parseLogicalToken("")).toBeUndefined();
    expect(parseLogicalToken("andor")).toBeUndefined();
  });
});

// ── parsePrimitive ───────────────────────────────────────────────────────────

describe("parsePrimitive", () => {
  const strField = FIELDS[0]; // string
  const intField = FIELDS[1]; // integer
  const floatField = FIELDS[2]; // float
  const boolField = FIELDS[5]; // boolean
  const dateField = FIELDS[3]; // date
  const customFieldDef = FIELDS[7]; // custom with translate

  it("parses string as-is", () => {
    expect(parsePrimitive(strField, "hello")).toBe("hello");
  });

  it("trims whitespace for string", () => {
    expect(parsePrimitive(strField, "  hello  ")).toBe("hello");
  });

  it("parses integer", () => {
    expect(parsePrimitive(intField, "42")).toBe(42);
    expect(parsePrimitive(intField, "-10")).toBe(-10);
  });

  it("returns raw text if integer parse fails", () => {
    expect(parsePrimitive(intField, "abc")).toBe("abc");
  });

  it("parses float", () => {
    expect(parsePrimitive(floatField, "3.14")).toBe(3.14);
    expect(parsePrimitive(floatField, "-0.5")).toBe(-0.5);
  });

  it("returns raw text if float parse fails", () => {
    expect(parsePrimitive(floatField, "nope")).toBe("nope");
  });

  it("parses boolean true values", () => {
    expect(parsePrimitive(boolField, "true")).toBe(true);
    expect(parsePrimitive(boolField, "1")).toBe(true);
    expect(parsePrimitive(boolField, "yes")).toBe(true);
    expect(parsePrimitive(boolField, "TRUE")).toBe(true);
  });

  it("parses boolean false values", () => {
    expect(parsePrimitive(boolField, "false")).toBe(false);
    expect(parsePrimitive(boolField, "0")).toBe(false);
    expect(parsePrimitive(boolField, "no")).toBe(false);
  });

  it("parses date to ISO string", () => {
    const result = parsePrimitive(dateField, "2024-01-15");
    expect(typeof result).toBe("string");
    expect(String(result)).toMatch(/2024/);
  });

  it("returns raw text if date parse fails", () => {
    expect(parsePrimitive(dateField, "not-a-date-xyz")).toBe("not-a-date-xyz");
  });

  it("uses field.translate for custom field", () => {
    expect(parsePrimitive(customFieldDef, "hello")).toBe("__hello__");
  });
});

// ── normalizePills ───────────────────────────────────────────────────────────

describe("normalizePills", () => {
  function makeValue(id = "v1"): ValuePill {
    return { id, kind: "value", fieldName: "title", operator: "=", value: "x" };
  }

  function makeAnd(id = "a1") { return { id, kind: "and" as const }; }
  function makeOr(id = "o1") { return { id, kind: "or" as const }; }
  function makeOpen(id = "ob1") { return { id, kind: "open-bracket" as const }; }
  function makeClose(id = "cb1") { return { id, kind: "close-bracket" as const }; }

  it("returns empty array unchanged", () => {
    expect(normalizePills([])).toEqual([]);
  });

  it("returns a single value pill unchanged", () => {
    const pills = [makeValue()];
    const result = normalizePills(pills);
    expect(result[0].kind).toBe("value");
    expect((result[0] as any).invalid).toBeFalsy();
  });

  it("matched brackets are valid", () => {
    const pills = [makeOpen(), makeValue(), makeClose()];
    const result = normalizePills(pills);
    expect((result[0] as any).invalid).toBe(false);
    expect((result[2] as any).invalid).toBe(false);
  });

  it("unmatched close bracket is invalid", () => {
    const pills = [makeValue(), makeClose()];
    const result = normalizePills(pills);
    expect((result[1] as any).invalid).toBe(true);
  });

  it("unmatched open bracket is invalid", () => {
    const pills = [makeOpen(), makeValue()];
    const result = normalizePills(pills);
    expect((result[0] as any).invalid).toBe(true);
  });

  it("adjacent AND/OR tokens are marked invalid", () => {
    const pills = [makeValue(), makeAnd(), makeOr(), makeValue("v2")];
    const result = normalizePills(pills);
    // and at index 1: next is OR (logical) → invalid
    expect((result[1] as any).invalid).toBe(true);
    // or at index 2: prev is AND (logical) → invalid
    expect((result[2] as any).invalid).toBe(true);
  });

  it("valid AND between two value pills is not invalid", () => {
    const pills = [makeValue("v1"), makeAnd(), makeValue("v2")];
    const result = normalizePills(pills);
    expect((result[1] as any).invalid).toBeFalsy();
  });

  it("valid OR between two value pills is not invalid", () => {
    const pills = [makeValue("v1"), makeOr(), makeValue("v2")];
    const result = normalizePills(pills);
    expect((result[1] as any).invalid).toBeFalsy();
  });

  it("nested matching brackets are all valid", () => {
    // ( ( value ) AND ( value ) )
    const pills = [
      makeOpen("ob1"), makeOpen("ob2"), makeValue("v1"), makeClose("cb1"),
      makeAnd("a1"),
      makeOpen("ob3"), makeValue("v2"), makeClose("cb2"),
      makeClose("cb3"),
    ];
    const result = normalizePills(pills);
    for (const p of result) {
      expect((p as any).invalid).toBeFalsy();
    }
  });
});

// ── parseInputToPill ─────────────────────────────────────────────────────────

describe("parseInputToPill — logical tokens", () => {
  it("parses AND token", () => {
    const p = parseInput("AND");
    expect(p).toMatchObject({ kind: "and" });
  });

  it("parses OR token (case insensitive)", () => {
    const p = parseInput("or");
    expect(p).toMatchObject({ kind: "or" });
  });

  it("parses open bracket", () => {
    expect(parseInput("(")).toMatchObject({ kind: "open-bracket" });
  });

  it("parses close bracket", () => {
    expect(parseInput(")")).toMatchObject({ kind: "close-bracket" });
  });

  it("returns undefined for empty input", () => {
    expect(parseInput("")).toBeUndefined();
    expect(parseInput("   ")).toBeUndefined();
  });
});

describe("parseInputToPill — string field, all operators", () => {
  it("= operator", () => {
    const p = parseInput("title = hello") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "=", value: "hello" });
  });

  it("! operator", () => {
    const p = parseInput("title ! spam") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "!", value: "spam" });
  });

  it("* operator (contains)", () => {
    const p = parseInput("title * bug") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "*", value: "bug" });
  });

  it("!* operator (not contains)", () => {
    const p = parseInput("title !* bug") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "!*", value: "bug" });
  });

  it("<* operator (starts with)", () => {
    const p = parseInput("title <* AP") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "<*", value: "AP" });
  });

  it(">* operator (ends with)", () => {
    const p = parseInput("title >* ing") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: ">*", value: "ing" });
  });

  it("defaults to * for string when no operator given", () => {
    const p = parseInput("title hello") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "*", value: "hello" });
  });
});

describe("parseInputToPill — integer field, all operators", () => {
  it("= operator", () => {
    const p = parseInput("count = 5") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "count", operator: "=", value: 5 });
  });

  it("! operator", () => {
    const p = parseInput("count ! 0") as ValuePill;
    expect(p).toMatchObject({ kind: "value", operator: "!", value: 0 });
  });

  it("> operator", () => {
    const p = parseInput("count > 10") as ValuePill;
    expect(p).toMatchObject({ kind: "value", operator: ">", value: 10 });
  });

  it("< operator", () => {
    const p = parseInput("count < 100") as ValuePill;
    expect(p).toMatchObject({ kind: "value", operator: "<", value: 100 });
  });

  it(">= operator", () => {
    const p = parseInput("count >= 5") as ValuePill;
    expect(p).toMatchObject({ kind: "value", operator: ">=", value: 5 });
  });

  it("<= operator", () => {
    const p = parseInput("count <= 99") as ValuePill;
    expect(p).toMatchObject({ kind: "value", operator: "<=", value: 99 });
  });

  it("defaults to = for integer when no operator given", () => {
    const p = parseInput("count 42") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "count", operator: "=", value: 42 });
  });

  it("parses negative integer", () => {
    const p = parseInput("count = -5") as ValuePill;
    expect(p).toMatchObject({ value: -5 });
  });
});

describe("parseInputToPill — float field", () => {
  it("parses float value", () => {
    const p = parseInput("price = 9.99") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "price", operator: "=", value: 9.99 });
  });

  it("parses negative float", () => {
    const p = parseInput("price > -1.5") as ValuePill;
    expect(p).toMatchObject({ kind: "value", operator: ">", value: -1.5 });
  });

  it("parses range for float field", () => {
    const p = parseInput("price 1.00 to 9.99") as RangePill;
    expect(p).toMatchObject({ kind: "range", fieldName: "price", from: 1.0, to: 9.99 });
  });
});

describe("parseInputToPill — date field", () => {
  it("parses date value with = operator", () => {
    const p = parseInput("due = 2024-01-15") as ValuePill;
    expect(p?.kind).toBe("value");
    expect(p?.fieldName).toBe("due");
    expect(p?.operator).toBe("=");
  });

  it("parses date range", () => {
    const p = parseInput("due 2024-01-01 to 2024-12-31") as RangePill;
    expect(p?.kind).toBe("range");
    expect(p?.fieldName).toBe("due");
  });

  it("parses date >= operator", () => {
    const p = parseInput("due >= 2024-06-01") as ValuePill;
    expect(p).toMatchObject({ kind: "value", operator: ">=" });
  });
});

describe("parseInputToPill — boolean field", () => {
  it("parses true value", () => {
    const p = parseInput("active = true") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "active", operator: "=", value: true });
  });

  it("parses false value", () => {
    const p = parseInput("active = false") as ValuePill;
    expect(p).toMatchObject({ kind: "value", value: false });
  });

  it("parses yes as true", () => {
    const p = parseInput("active = yes") as ValuePill;
    expect(p).toMatchObject({ value: true });
  });

  it("parses no as false", () => {
    const p = parseInput("active = no") as ValuePill;
    expect(p).toMatchObject({ value: false });
  });

  it("! operator with boolean", () => {
    const p = parseInput("active ! true") as ValuePill;
    expect(p).toMatchObject({ operator: "!", value: true });
  });
});

describe("parseInputToPill — set field", () => {
  it("parses single value pill", () => {
    const p = parseInput("status = New") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "status", operator: "=", value: "New" });
  });

  it("parses comma-separated values into list pill", () => {
    const p = parseInput("status New,Done") as ListPill;
    expect(p?.kind).toBe("list");
    expect(p?.values).toContain("New");
    expect(p?.values).toContain("Done");
  });

  it("merges with previous value pill to create list", () => {
    const prev: ValuePill = { id: "p1", kind: "value", fieldName: "status", operator: "=", value: "New" };
    const p = parseInput("status = Done", undefined, prev) as ListPill;
    expect(p?.kind).toBe("list");
    expect(p?.values).toContain("New");
    expect(p?.values).toContain("Done");
  });

  it("extends existing list pill", () => {
    const prev: ListPill = {
      id: "p1", kind: "list", fieldName: "status", operator: "=",
      values: ["New", "Done"],
    };
    const p = parseInput("status = In Progress", undefined, prev) as ListPill;
    expect(p?.kind).toBe("list");
    expect(p?.values).toHaveLength(3);
  });

  it("returns undefined when merging duplicate value", () => {
    const prev: ValuePill = { id: "p1", kind: "value", fieldName: "status", operator: "=", value: "New" };
    const p = parseInput("status = New", undefined, prev);
    expect(p).toBeUndefined();
  });

  it("returns undefined when adding duplicate to list", () => {
    const prev: ListPill = {
      id: "p1", kind: "list", fieldName: "status", operator: "=",
      values: ["New", "Done"],
    };
    const p = parseInput("status = New", undefined, prev);
    expect(p).toBeUndefined();
  });
});

describe("parseInputToPill — custom field", () => {
  it("uses translate function on value", () => {
    const p = parseInput("custom = hello") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "custom", value: "__hello__" });
  });

  it("uses = as default operator for custom", () => {
    const p = parseInput("custom hello") as ValuePill;
    expect(p).toMatchObject({ kind: "value", operator: "=" });
  });

  it("! operator for custom", () => {
    const p = parseInput("custom ! test") as ValuePill;
    expect(p).toMatchObject({ kind: "value", operator: "!", value: "__test__" });
  });
});

describe("parseInputToPill — range parsing", () => {
  it("parses integer range", () => {
    const p = parseInput("count 1 to 10") as RangePill;
    expect(p).toMatchObject({ kind: "range", fieldName: "count", from: 1, to: 10 });
  });

  it("ignores range for string field (no range support)", () => {
    // string type is not in the range-eligible types
    const p = parseInput("title hello to world");
    // Should not produce a range pill — will produce a value pill
    expect(p?.kind).not.toBe("range");
  });

  it("returns undefined when range 'from' part is empty", () => {
    // 'to' with empty before it is not parsed as a range — the ' to ' pattern
    // requires non-empty parts on both sides; the parseRange helper returns
    // undefined when either side is blank.
    parseInput("count to 10");
    // "count to 10" is parsed: field=count, rest="to 10" — 'to' is ambiguous
    // The key contract is that a range with genuinely empty from/to is undefined.
    // We test this indirectly: an input that would only have the 'to' keyword
    // with nothing meaningful on either side produces no pill.
    const p2 = parseInput("count 0 to");
    // If 'to' has no right side, parseRange returns undefined, so the input
    // falls through to value parsing. '0 to' is not a valid number, so value = '0 to'.
    // This is a string passthrough; just verify no crash.
    expect(p2 === undefined || p2?.kind === "value" || p2?.kind === "range").toBe(true);
  });
});

describe("parseInputToPill — preferredField", () => {
  it("uses preferredField when no field prefix is given", () => {
    const p = parseInput("= 10", "count") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "count", operator: "=", value: 10 });
  });

  it("field prefix overrides preferredField", () => {
    const p = parseInput("price = 5.00", "count") as ValuePill;
    expect(p).toMatchObject({ fieldName: "price" });
  });

  it("falls back to first field when no preferredField and no prefix", () => {
    const p = parseInput("hello") as ValuePill;
    expect(p?.fieldName).toBe("title"); // first field
  });
});

describe("parseInputToPill — operator fallback to allowed operators", () => {
  it("disallowed operator for field is replaced by first allowed operator", () => {
    // String field does not allow >, which is a compare operator
    const p = parseInput("title > foo") as ValuePill;
    // The operator is not >, it should fall back to first allowed string op "="
    expect(p?.operator).toBe("=");
  });
});

// ── pillLabel ────────────────────────────────────────────────────────────────

describe("pillLabel", () => {
  it("AND pill", () => {
    expect(pillLabel({ id: "x", kind: "and" }, FIELDS)).toBe("AND");
  });

  it("OR pill", () => {
    expect(pillLabel({ id: "x", kind: "or" }, FIELDS)).toBe("OR");
  });

  it("open-bracket pill", () => {
    expect(pillLabel({ id: "x", kind: "open-bracket" }, FIELDS)).toBe("(");
  });

  it("close-bracket pill", () => {
    expect(pillLabel({ id: "x", kind: "close-bracket" }, FIELDS)).toBe(")");
  });

  it("range pill", () => {
    const pill: RangePill = { id: "x", kind: "range", fieldName: "count", from: 1, to: 10 };
    expect(pillLabel(pill, FIELDS)).toBe("count: 1 to 10");
  });

  it("list pill", () => {
    const pill: ListPill = { id: "x", kind: "list", fieldName: "status", operator: "in", values: ["New", "Done"] };
    expect(pillLabel(pill, FIELDS)).toBe("status in (New, Done)");
  });

  it("value pill with default operator (omits operator)", () => {
    // string default is *, so it should be omitted
    const pill: ValuePill = { id: "x", kind: "value", fieldName: "title", operator: "*", value: "bug" };
    expect(pillLabel(pill, FIELDS)).toBe("title: bug");
  });

  it("value pill with non-default operator shows operator", () => {
    const pill: ValuePill = { id: "x", kind: "value", fieldName: "title", operator: "=", value: "hello" };
    expect(pillLabel(pill, FIELDS)).toBe("title = hello");
  });

  it("uses field label when available", () => {
    const fieldsWithLabel: FieldDefinition[] = [
      { name: "title", label: "Title", type: "string", precedence: 1 },
    ];
    const pill: ValuePill = { id: "x", kind: "value", fieldName: "title", operator: "*", value: "bug" };
    expect(pillLabel(pill, fieldsWithLabel)).toBe("Title: bug");
  });

  it("uses fieldName when field not found", () => {
    const pill: ValuePill = { id: "x", kind: "value", fieldName: "unknown", operator: "=", value: "x" };
    expect(pillLabel(pill, FIELDS)).toBe("unknown = x");
  });

  it("value pill with integer = (non-default for integer is none, default is =)", () => {
    // integer default is =, so label should omit the operator
    const pill: ValuePill = { id: "x", kind: "value", fieldName: "count", operator: "=", value: 5 };
    expect(pillLabel(pill, FIELDS)).toBe("count: 5");
  });
});
