/**
 * nlpResolver.test.ts
 *
 * Comprehensive tests for resolveNlpExpression and resolveNlpQuery covering:
 *   - All field types: string, integer, float, date, datetime, boolean, set
 *   - All operators for each field type
 *   - Range expressions: "between X and Y", "from X to Y", fieldless forms
 *   - List expressions: "in X,Y,Z", "one of X,Y,Z", negative forms
 *   - Boolean-logic combinations with AND / OR and brackets
 *   - Value-only inference: set-value match, boolean match, highest-precedence fallback
 *   - Operator + value (no field name): leading-symbol operator forms
 *   - Word-alias operators for every canonical symbol
 */

import { describe, expect, it } from "vitest";
import { resolveNlpExpression, resolveNlpQuery, resolveDatePhrase, wordsToNumber } from "./nlpResolver";
import type { FieldDefinition, ListPill, RangePill, ValuePill } from "./types";

// â”€â”€â”€ Shared field definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const FIELDS: FieldDefinition[] = [
  { name: "title",   type: "string",   precedence: 1 },
  { name: "count",   type: "integer",  precedence: 2 },
  { name: "price",   type: "float",    precedence: 3 },
  { name: "due",     type: "date",     precedence: 4 },
  { name: "created", type: "datetime", precedence: 5 },
  { name: "active",  type: "boolean",  precedence: 6 },
  {
    name: "status", type: "set", precedence: 7,
    setValues: ["New", "In Progress", "Done", "Blocked"],
  },
];

// Resolves a single NLP expression against the shared field set.
function resolve(line: string) {
  return resolveNlpExpression(line, FIELDS);
}

// Computes the ISO-date string the resolver produces for a given date input,
// using the same local-time interpretation the code uses.  This makes
// date-value assertions timezone-independent.
function codeDate(s: string): string {
  const d = new Date(s);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// â”€â”€â”€ STRING field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("string field â€” symbol operators", () => {
  it("= (equals sign)", () => {
    const p = resolve("title = hello") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "=", value: "hello" });
  });

  it("! (bang)", () => {
    const p = resolve("title ! spam") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "!", value: "spam" });
  });

  it("* (contains)", () => {
    const p = resolve("title * bug") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "*", value: "bug" });
  });

  it("!* (not-contains)", () => {
    const p = resolve("title !* spam") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "!*", value: "spam" });
  });

  it("<* (starts-with)", () => {
    const p = resolve("title <* AP") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "<*", value: "AP" });
  });

  it(">* (ends-with)", () => {
    const p = resolve("title >* ing") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: ">*", value: "ing" });
  });
});

describe("string field â€” word-alias operators", () => {
  it("'is' â†’ =", () => {
    expect(resolve("title is hello")).toMatchObject({ operator: "=" });
  });

  it("'equals' â†’ =", () => {
    expect(resolve("title equals hello")).toMatchObject({ operator: "=" });
  });

  it("'matches' â†’ =", () => {
    expect(resolve("title matches hello")).toMatchObject({ operator: "=" });
  });

  it("'is not' â†’ !", () => {
    expect(resolve("title is not spam")).toMatchObject({ operator: "!" });
  });

  it("'not' â†’ !", () => {
    expect(resolve("title not spam")).toMatchObject({ operator: "!" });
  });

  it("'contains' â†’ *", () => {
    expect(resolve("title contains bug")).toMatchObject({ operator: "*" });
  });

  it("'includes' â†’ *", () => {
    expect(resolve("title includes bug")).toMatchObject({ operator: "*" });
  });

  it("'like' â†’ *", () => {
    expect(resolve("title like bug")).toMatchObject({ operator: "*" });
  });

  it("'does not contain' â†’ !*", () => {
    expect(resolve("title does not contain spam")).toMatchObject({ operator: "!*" });
  });

  it("'excludes' â†’ !*", () => {
    expect(resolve("title excludes spam")).toMatchObject({ operator: "!*" });
  });

  it("'starts with' â†’ <*", () => {
    expect(resolve("title starts with AP")).toMatchObject({ operator: "<*" });
  });

  it("'begins with' â†’ <*", () => {
    expect(resolve("title begins with AP")).toMatchObject({ operator: "<*" });
  });

  it("'ends with' â†’ >*", () => {
    expect(resolve("title ends with ing")).toMatchObject({ operator: ">*" });
  });
});

// â”€â”€â”€ INTEGER field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("integer field â€” symbol operators", () => {
  it("= integer value", () => {
    const p = resolve("count = 5") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "count", operator: "=", value: 5 });
  });

  it("! integer value", () => {
    const p = resolve("count ! 0") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "count", operator: "!", value: 0 });
  });

  it("> greater-than", () => {
    const p = resolve("count > 10") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "count", operator: ">", value: 10 });
  });

  it("< less-than", () => {
    const p = resolve("count < 5") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "count", operator: "<", value: 5 });
  });

  it(">= at-least", () => {
    const p = resolve("count >= 3") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "count", operator: ">=", value: 3 });
  });

  it("<= at-most", () => {
    const p = resolve("count <= 7") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "count", operator: "<=", value: 7 });
  });

  it("value is parsed as a number (not a string)", () => {
    const p = resolve("count = 42") as ValuePill;
    expect(typeof p.value).toBe("number");
    expect(p.value).toBe(42);
  });
});

describe("integer field â€” word-alias operators", () => {
  it("'greater than' â†’ >", () => {
    expect(resolve("count greater than 10")).toMatchObject({ fieldName: "count", operator: ">" });
  });

  it("'less than' â†’ <", () => {
    expect(resolve("count less than 5")).toMatchObject({ fieldName: "count", operator: "<" });
  });

  it("'more than' â†’ >", () => {
    expect(resolve("count more than 10")).toMatchObject({ operator: ">" });
  });

  it("'fewer than' â†’ <", () => {
    expect(resolve("count fewer than 5")).toMatchObject({ operator: "<" });
  });

  it("'at least' â†’ >=", () => {
    expect(resolve("count at least 3")).toMatchObject({ operator: ">=" });
  });

  it("'at most' â†’ <=", () => {
    expect(resolve("count at most 7")).toMatchObject({ operator: "<=" });
  });

  it("'greater than or equal to' â†’ >=", () => {
    expect(resolve("count greater than or equal to 3")).toMatchObject({ operator: ">=" });
  });

  it("'less than or equal to' â†’ <=", () => {
    expect(resolve("count less than or equal to 7")).toMatchObject({ operator: "<=" });
  });

  it("'over' â†’ >", () => {
    expect(resolve("count over 10")).toMatchObject({ operator: ">" });
  });

  it("'under' â†’ <", () => {
    expect(resolve("count under 5")).toMatchObject({ operator: "<" });
  });

  it("'minimum' â†’ >=", () => {
    expect(resolve("count minimum 3")).toMatchObject({ operator: ">=" });
  });

  it("'maximum' â†’ <=", () => {
    expect(resolve("count maximum 7")).toMatchObject({ operator: "<=" });
  });

  it("'no less than' â†’ >=", () => {
    expect(resolve("count no less than 3")).toMatchObject({ operator: ">=" });
  });

  it("'no more than' â†’ <=", () => {
    expect(resolve("count no more than 7")).toMatchObject({ operator: "<=" });
  });
});

// â”€â”€â”€ FLOAT field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("float field â€” symbol operators", () => {
  it("= float value", () => {
    const p = resolve("price = 9.99") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "price", operator: "=", value: 9.99 });
  });

  it("! float value", () => {
    const p = resolve("price ! 0") as ValuePill;
    expect(p).toMatchObject({ fieldName: "price", operator: "!", value: 0 });
  });

  it("> float value", () => {
    const p = resolve("price > 10.5") as ValuePill;
    expect(p).toMatchObject({ fieldName: "price", operator: ">", value: 10.5 });
  });

  it("< float value", () => {
    const p = resolve("price < 5.0") as ValuePill;
    expect(p).toMatchObject({ fieldName: "price", operator: "<", value: 5 });
  });

  it(">= float value", () => {
    const p = resolve("price >= 3.14") as ValuePill;
    expect(p).toMatchObject({ fieldName: "price", operator: ">=", value: 3.14 });
  });

  it("<= float value", () => {
    const p = resolve("price <= 7.5") as ValuePill;
    expect(p).toMatchObject({ fieldName: "price", operator: "<=", value: 7.5 });
  });

  it("value is parsed as a number (float)", () => {
    const p = resolve("price = 3.14") as ValuePill;
    expect(typeof p.value).toBe("number");
    expect(p.value).toBeCloseTo(3.14);
  });
});

// â”€â”€â”€ DATE field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("date field â€” symbol operators with ISO dates", () => {
  it("= ISO date", () => {
    const p = resolve("due = 2026-01-15") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.fieldName).toBe("due");
    expect(p.operator).toBe("=");
    expect(p.value).toBe(codeDate("2026-01-15"));
  });

  it("! ISO date", () => {
    const p = resolve("due ! 2026-01-15") as ValuePill;
    expect(p).toMatchObject({ fieldName: "due", operator: "!" });
  });

  it("> ISO date", () => {
    const p = resolve("due > 2026-01-01") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "due", operator: ">" });
  });

  it("< ISO date", () => {
    const p = resolve("due < 2026-12-31") as ValuePill;
    expect(p).toMatchObject({ fieldName: "due", operator: "<" });
  });

  it(">= ISO date", () => {
    const p = resolve("due >= 2026-06-01") as ValuePill;
    expect(p).toMatchObject({ fieldName: "due", operator: ">=" });
  });

  it("<= ISO date", () => {
    const p = resolve("due <= 2026-09-30") as ValuePill;
    expect(p).toMatchObject({ fieldName: "due", operator: "<=" });
  });

  it("'before' â†’ < operator", () => {
    expect(resolve("due before 2026-01-01")).toMatchObject({ fieldName: "due", operator: "<" });
  });

  it("'after' â†’ > operator", () => {
    expect(resolve("due after 2026-12-31")).toMatchObject({ fieldName: "due", operator: ">" });
  });
});

describe("date field â€” relative phrases that produce RangePill", () => {
  it("'today' â†’ range covering start and end of today", () => {
    const p = resolve("due = today") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("due");
    expect(typeof p.from).toBe("string");
    expect(typeof p.to).toBe("string");
  });

  it("'yesterday' â†’ range", () => {
    const p = resolve("due = yesterday") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("due");
  });

  it("'this week' â†’ range", () => {
    const p = resolve("due = this week") as RangePill;
    expect(p.kind).toBe("range");
  });

  it("'last week' â†’ range", () => {
    const p = resolve("due = last week") as RangePill;
    expect(p.kind).toBe("range");
  });

  it("'next week' â†’ range", () => {
    const p = resolve("due = next week") as RangePill;
    expect(p.kind).toBe("range");
  });

  it("'this month' â†’ range", () => {
    const p = resolve("due = this month") as RangePill;
    expect(p.kind).toBe("range");
  });

  it("'last month' â†’ range", () => {
    const p = resolve("due = last month") as RangePill;
    expect(p.kind).toBe("range");
  });

  it("'this year' â†’ range", () => {
    const p = resolve("due = this year") as RangePill;
    expect(p.kind).toBe("range");
  });
});

// â”€â”€â”€ DATETIME field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("datetime field â€” operators", () => {
  it("= ISO date â†’ datetime string", () => {
    const p = resolve("created = 2026-01-15") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.fieldName).toBe("created");
    expect(p.operator).toBe("=");
    // Value is a datetime string (yyyy-MM-dd HH:mm:ss)
    expect(typeof p.value).toBe("string");
    expect((p.value as string)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("> datetime", () => {
    expect(resolve("created > 2026-01-01")).toMatchObject({ fieldName: "created", operator: ">" });
  });

  it("< datetime", () => {
    expect(resolve("created < 2026-12-31")).toMatchObject({ fieldName: "created", operator: "<" });
  });

  it(">= datetime", () => {
    expect(resolve("created >= 2026-06-01")).toMatchObject({ fieldName: "created", operator: ">=" });
  });

  it("<= datetime", () => {
    expect(resolve("created <= 2026-09-30")).toMatchObject({ fieldName: "created", operator: "<=" });
  });

  it("'today' â†’ RangePill with datetime strings", () => {
    const p = resolve("created = today") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("created");
    // datetime format includes time component
    expect((p.from as string)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect((p.to as string)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("'now' â†’ ValuePill (no range end)", () => {
    const p = resolve("created = now") as ValuePill;
    expect(p.kind).toBe("value");
    expect((p.value as string)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

// â”€â”€â”€ BOOLEAN field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("boolean field â€” all operators and value forms", () => {
  it("= true", () => {
    expect(resolve("active = true")).toMatchObject({ fieldName: "active", operator: "=", value: true });
  });

  it("= false", () => {
    expect(resolve("active = false")).toMatchObject({ fieldName: "active", operator: "=", value: false });
  });

  it("= yes â†’ true", () => {
    expect(resolve("active = yes")).toMatchObject({ fieldName: "active", operator: "=", value: true });
  });

  it("= no â†’ false", () => {
    expect(resolve("active = no")).toMatchObject({ fieldName: "active", operator: "=", value: false });
  });

  it("= 1 â†’ true", () => {
    expect(resolve("active = 1")).toMatchObject({ fieldName: "active", operator: "=", value: true });
  });

  it("= 0 â†’ false", () => {
    expect(resolve("active = 0")).toMatchObject({ fieldName: "active", operator: "=", value: false });
  });

  it("= on â†’ true", () => {
    expect(resolve("active = on")).toMatchObject({ fieldName: "active", value: true });
  });

  it("! true (negated)", () => {
    expect(resolve("active ! true")).toMatchObject({ fieldName: "active", operator: "!", value: true });
  });

  it("! false (negated)", () => {
    expect(resolve("active ! false")).toMatchObject({ fieldName: "active", operator: "!", value: false });
  });

  it("'is' true â†’ =", () => {
    expect(resolve("active is true")).toMatchObject({ fieldName: "active", operator: "=", value: true });
  });

  it("'is not' true â†’ !", () => {
    expect(resolve("active is not true")).toMatchObject({ fieldName: "active", operator: "!", value: true });
  });
});

// â”€â”€â”€ SET field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("set field â€” symbol operators", () => {
  it("= set value", () => {
    expect(resolve("status = Done")).toMatchObject({
      kind: "value", fieldName: "status", operator: "=", value: "Done",
    });
  });

  it("! (exclude) set value", () => {
    expect(resolve("status ! Blocked")).toMatchObject({
      kind: "value", fieldName: "status", operator: "!", value: "Blocked",
    });
  });

  it("'is' â†’ =", () => {
    expect(resolve("status is New")).toMatchObject({ fieldName: "status", operator: "=" });
  });

  it("'is not' â†’ !", () => {
    expect(resolve("status is not Done")).toMatchObject({ fieldName: "status", operator: "!" });
  });

  it("'not' â†’ !", () => {
    expect(resolve("status not Blocked")).toMatchObject({ fieldName: "status", operator: "!" });
  });
});

describe("set field â€” list operators (positive)", () => {
  it("'in' with comma-separated values", () => {
    const p = resolve("status in New,Done,Blocked") as ListPill;
    expect(p.kind).toBe("list");
    expect(p.fieldName).toBe("status");
    expect(p.operator).toBe("in");
    expect(p.values).toEqual(["New", "Done", "Blocked"]);
  });

  it("'in' with spaced commas", () => {
    const p = resolve("status in New, Done, Blocked") as ListPill;
    expect(p.values).toHaveLength(3);
  });

  it("'one of' with comma-separated values", () => {
    const p = resolve("status one of New, Done") as ListPill;
    expect(p.kind).toBe("list");
    expect(p.operator).toBe("in");
    expect(p.values).toHaveLength(2);
    expect(p.values).toContain("New");
    expect(p.values).toContain("Done");
  });

  it("'any of' â†’ positive list", () => {
    const p = resolve("status any of New, Done") as ListPill;
    expect(p.kind).toBe("list");
    expect(p.operator).toBe("in");
  });

  it("'in' with or-separated values", () => {
    const p = resolve("status in New or Done or Blocked") as ListPill;
    expect(p.kind).toBe("list");
    expect(p.values).toHaveLength(3);
  });

  it("single value after 'in' â†’ list with one item", () => {
    const p = resolve("status in New") as ListPill;
    expect(p.kind).toBe("list");
    expect(p.values).toEqual(["New"]);
  });
});

describe("set field â€” list operators (negative)", () => {
  it("'not one of' â†’ negative list", () => {
    const p = resolve("status not one of New,Done") as ListPill;
    expect(p.kind).toBe("list");
    expect(p.operator).toBe("!");
    expect(p.values).toHaveLength(2);
  });

  it("'none of' â†’ negative list", () => {
    const p = resolve("status none of New,Done") as ListPill;
    expect(p.kind).toBe("list");
    expect(p.operator).toBe("!");
    expect(p.values).toHaveLength(2);
  });

  it("'not in' â†’ negative list", () => {
    const p = resolve("status not in New,Done") as ListPill;
    expect(p.kind).toBe("list");
    expect(p.operator).toBe("!");
    expect(p.values).toHaveLength(2);
  });

  it("'not any of' â†’ negative list", () => {
    const p = resolve("status not any of New,Done") as ListPill;
    expect(p.kind).toBe("list");
    expect(p.operator).toBe("!");
  });
});

// â”€â”€â”€ RANGE expressions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("range expressions â€” 'between X and Y'", () => {
  it("float field: between", () => {
    const p = resolve("price between 10 and 50") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("price");
    expect(p.from).toBe(10);
    expect(p.to).toBe(50);
  });

  it("cost between 1 and 10 â†’ RangePill with from=1, to=10 (bug regression)", () => {
    // Reported: entering "cost between 1 and 10" produced a pill showing "Cost: to 10"
    // (the from value was missing). The resolver must produce from=1, NOT undefined/"".
    const fields: FieldDefinition[] = [
      { name: "cost", type: "float", precedence: 1 },
    ];
    const p = resolveNlpExpression("cost between 1 and 10", fields) as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("cost");
    expect(p.from).toBe(1);
    expect(p.to).toBe(10);
  })

  it("integer field: between", () => {
    const p = resolve("count between 1 and 100") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("count");
    expect(p.from).toBe(1);
    expect(p.to).toBe(100);
  });

  it("date field: between ISO dates", () => {
    const p = resolve("due between 2026-01-01 and 2026-12-31") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("due");
    expect(typeof p.from).toBe("string");
    expect(typeof p.to).toBe("string");
  });

  it("fieldless 'between X and Y' â†’ uses first range-capable field (count)", () => {
    const p = resolve("between 10 and 50") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("count");  // count is lowest-precedence range field (prec=2)
    expect(p.from).toBe(10);
    expect(p.to).toBe(50);
  });
});

describe("range expressions â€” 'from X to Y'", () => {
  it("float field: from â€¦ to", () => {
    const p = resolve("price from 10 to 50") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("price");
    expect(p.from).toBe(10);
    expect(p.to).toBe(50);
  });

  it("integer field: from â€¦ to", () => {
    const p = resolve("count from 5 to 20") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("count");
  });

  it("date field: from â€¦ to with ISO dates", () => {
    const p = resolve("due from 2026-01-01 to 2026-06-30") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("due");
    expect(typeof p.from).toBe("string");
    expect(typeof p.to).toBe("string");
  });

  it("fieldless 'from X to Y' â†’ uses first range-capable field (count)", () => {
    const p = resolve("from 10 to 50") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("count");
    expect(p.from).toBe(10);
    expect(p.to).toBe(50);
  });
});

describe("range expressions â€” 'field X to Y' (implicit from â€” round-trip format)", () => {
  it("'cost 1 to 10' â†’ RangePill (AI round-trip serialization format)", () => {
    // The AI round-trip serializer previously produced "cost 1 to 10".
    // resolveNlpExpression must parse this as a range, not a value pill.
    const fields: FieldDefinition[] = [
      { name: "cost", type: "float", precedence: 1 },
    ];
    const p = resolveNlpExpression("cost 1 to 10", fields) as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("cost");
    expect(p.from).toBe(1);
    expect(p.to).toBe(10);
  });

  it("integer 'field X to Y'", () => {
    const p = resolve("count 5 to 20") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("count");
    expect(p.from).toBe(5);
    expect(p.to).toBe(20);
  });

  it("float 'field X to Y'", () => {
    const p = resolve("price 10.5 to 50.0") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("price");
    expect(p.from).toBe(10.5);
    expect(p.to).toBe(50);
  });

  it("date 'field X to Y' with ISO dates", () => {
    const p = resolve("due 2026-01-01 to 2026-12-31") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("due");
    expect(typeof p.from).toBe("string");
    expect(typeof p.to).toBe("string");
  });

  it("'field X to Y' does NOT fire for string fields (no range operators)", () => {
    // title is a string field â€” should NOT be parsed as a range
    const p = resolve("title hello to world");
    expect(p?.kind).not.toBe("range");
  });

  it("round-trip: resolveNlpQuery then re-resolve produces same RangePill", () => {
    // Verifies the full AI round-trip:
    //   resolveNlpQuery("cost between 1 and 10") â†’ RangePill
    //   serialize â†’ "cost from 1 to 10"
    //   resolveNlpExpression("cost from 1 to 10") â†’ same RangePill
    const fields: FieldDefinition[] = [
      { name: "cost", type: "float", precedence: 1 },
    ];
    const pills = resolveNlpQuery("cost between 1 and 10", fields);
    expect(pills).toHaveLength(1);
    const range = pills[0] as RangePill;
    expect(range.kind).toBe("range");
    expect(range.fieldName).toBe("cost");
    expect(range.from).toBe(1);
    expect(range.to).toBe(10);

    // Simulate the serializer
    const serialized = `${range.fieldName} from ${String(range.from)} to ${String(range.to)}`;
    expect(serialized).toBe("cost from 1 to 10");

    // Re-resolve the serialized form
    const re = resolveNlpExpression(serialized, fields) as RangePill;
    expect(re.kind).toBe("range");
    expect(re.fieldName).toBe("cost");
    expect(re.from).toBe(1);
    expect(re.to).toBe(10);
  });
});

// â”€â”€â”€ VALUE-ONLY INFERENCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("value-only: set-value inference (no field, no operator)", () => {
  it("'Done' â†’ status = Done", () => {
    expect(resolve("Done")).toMatchObject({
      kind: "value", fieldName: "status", operator: "=", value: "Done",
    });
  });

  it("'New' â†’ status = New", () => {
    expect(resolve("New")).toMatchObject({ fieldName: "status", value: "New" });
  });

  it("'Blocked' â†’ status = Blocked", () => {
    expect(resolve("Blocked")).toMatchObject({ fieldName: "status", value: "Blocked" });
  });

  it("'In Progress' (multi-word set value) â†’ status = In Progress", () => {
    expect(resolve("In Progress")).toMatchObject({
      kind: "value", fieldName: "status", operator: "=", value: "In Progress",
    });
  });

  it("case-insensitive: 'done' â†’ status = done", () => {
    const p = resolve("done") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.fieldName).toBe("status");
  });
});

describe("value-only: boolean-value inference", () => {
  it("'true' â†’ active = true", () => {
    expect(resolve("true")).toMatchObject({
      kind: "value", fieldName: "active", operator: "=", value: true,
    });
  });

  it("'false' â†’ active = false", () => {
    expect(resolve("false")).toMatchObject({ fieldName: "active", value: false });
  });

  it("'yes' â†’ active = true", () => {
    const p = resolve("yes") as ValuePill;
    expect(p.fieldName).toBe("active");
    expect(p.value).toBe(true);
  });

  it("'no' â†’ active = false", () => {
    const p = resolve("no") as ValuePill;
    expect(p.fieldName).toBe("active");
    expect(p.value).toBe(false);
  });
});

describe("value-only: highest-precedence fallback (unknown single token)", () => {
  it("unknown word â†’ title (precedence 1) with default * operator", () => {
    const p = resolve("hello") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.fieldName).toBe("title");   // title has precedence 1 (highest)
    expect(p.operator).toBe("*");        // default operator for string
    expect(p.value).toBe("hello");
  });

  it("another unknown word â†’ title", () => {
    const p = resolve("foobar") as ValuePill;
    expect(p.fieldName).toBe("title");
  });
});

// â”€â”€â”€ OPERATOR + VALUE (no field â€” leading symbol) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("operator + value without field name", () => {
  it("> 10 â†’ first range-capable field (count) with >", () => {
    const p = resolve("> 10") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.fieldName).toBe("count");   // count is first field supporting >
    expect(p.operator).toBe(">");
    expect(p.value).toBe(10);
  });

  it("< 5 â†’ count with <", () => {
    const p = resolve("< 5") as ValuePill;
    expect(p).toMatchObject({ fieldName: "count", operator: "<", value: 5 });
  });

  it(">= 3 â†’ count with >=", () => {
    const p = resolve(">= 3") as ValuePill;
    expect(p).toMatchObject({ fieldName: "count", operator: ">=", value: 3 });
  });

  it("<= 7 â†’ count with <=", () => {
    const p = resolve("<= 7") as ValuePill;
    expect(p).toMatchObject({ fieldName: "count", operator: "<=", value: 7 });
  });

  it("= hello â†’ title (first field supporting =) with =", () => {
    const p = resolve("= hello") as ValuePill;
    expect(p).toMatchObject({ fieldName: "title", operator: "=", value: "hello" });
  });

  it("!= Done â†’ title with ! (negation)", () => {
    const p = resolve("!= Done") as ValuePill;
    expect(p).toMatchObject({ fieldName: "title", operator: "!" });
  });

  it("! spam â†’ title with !", () => {
    const p = resolve("! spam") as ValuePill;
    expect(p).toMatchObject({ fieldName: "title", operator: "!" });
  });

  it("* bug â†’ title (string) with *", () => {
    const p = resolve("* bug") as ValuePill;
    expect(p).toMatchObject({ fieldName: "title", operator: "*", value: "bug" });
  });

  it("!* spam â†’ title with !*", () => {
    const p = resolve("!* spam") as ValuePill;
    expect(p).toMatchObject({ fieldName: "title", operator: "!*", value: "spam" });
  });

  it("<* AP â†’ title with <*", () => {
    const p = resolve("<* AP") as ValuePill;
    expect(p).toMatchObject({ fieldName: "title", operator: "<*", value: "AP" });
  });

  it(">* ing â†’ title with >*", () => {
    const p = resolve(">* ing") as ValuePill;
    expect(p).toMatchObject({ fieldName: "title", operator: ">*", value: "ing" });
  });
});

// â”€â”€â”€ IMPLICIT FIELD (field matched from token, no operator) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("implicit operator (two-token: field + value)", () => {
  it("string field + value â†’ default operator * (contains)", () => {
    const p = resolve("title hello") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "title", operator: "*", value: "hello" });
  });

  it("integer field + value â†’ default operator = (equals)", () => {
    const p = resolve("count 42") as ValuePill;
    expect(p).toMatchObject({ kind: "value", fieldName: "count", operator: "=", value: 42 });
  });

  it("float field + value â†’ default operator =", () => {
    const p = resolve("price 9.99") as ValuePill;
    expect(p).toMatchObject({ fieldName: "price", operator: "=", value: 9.99 });
  });

  it("boolean field + value â†’ =", () => {
    const p = resolve("active true") as ValuePill;
    expect(p).toMatchObject({ fieldName: "active", operator: "=", value: true });
  });

  it("set field + value â†’ default operator =", () => {
    const p = resolve("status Done") as ValuePill;
    expect(p).toMatchObject({ fieldName: "status", operator: "=", value: "Done" });
  });
});

// â”€â”€â”€ FIELD NAME MATCHING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("field matching â€” prefix and label", () => {
  it("exact name match wins", () => {
    expect(resolve("title = hello")).toMatchObject({ fieldName: "title" });
    expect(resolve("count = 5")).toMatchObject({ fieldName: "count" });
  });

  it("prefix match: 'tit' â†’ title", () => {
    const p = resolve("tit = hello") as ValuePill;
    expect(p.fieldName).toBe("title");
  });

  it("prefix match: 'pr' â†’ price", () => {
    const p = resolve("pr = 10") as ValuePill;
    expect(p.fieldName).toBe("price");
  });

  it("unrecognised field token falls back to highest-precedence field (title)", () => {
    const p = resolve("xyzfield = hello") as ValuePill;
    expect(p.fieldName).toBe("title");
  });
});

// â”€â”€â”€ resolveNlpQuery â€” multi-clause parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("resolveNlpQuery â€” AND / OR connectors", () => {
  it("single clause", () => {
    const pills = resolveNlpQuery("count > 5", FIELDS);
    expect(pills).toHaveLength(1);
    expect(pills[0]).toMatchObject({ kind: "value", fieldName: "count", operator: ">" });
  });

  it("two clauses joined by AND", () => {
    const pills = resolveNlpQuery("count > 5 and title = hello", FIELDS);
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "value", fieldName: "count" });
    expect(pills[1]).toMatchObject({ kind: "and" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "title" });
  });

  it("two clauses joined by OR", () => {
    const pills = resolveNlpQuery("count > 5 or count < 1", FIELDS);
    expect(pills).toHaveLength(3);
    expect(pills[1]).toMatchObject({ kind: "or" });
  });

  it("three clauses: A and B and C", () => {
    const pills = resolveNlpQuery("count > 5 and count < 10 and title = hello", FIELDS);
    expect(pills).toHaveLength(5);
    expect(pills[1]).toMatchObject({ kind: "and" });
    expect(pills[3]).toMatchObject({ kind: "and" });
  });

  it("mixed AND / OR", () => {
    const pills = resolveNlpQuery("count > 10 or count < 0 and title = bug", FIELDS);
    expect(pills.length).toBeGreaterThanOrEqual(5);
    const kinds = pills.map((p) => p.kind);
    expect(kinds).toContain("or");
    expect(kinds).toContain("and");
  });

  it("case-insensitive connectors: AND, And, and", () => {
    expect(resolveNlpQuery("count > 5 AND title = hello", FIELDS)).toHaveLength(3);
    expect(resolveNlpQuery("count > 5 And title = hello", FIELDS)).toHaveLength(3);
  });
});

describe("resolveNlpQuery â€” bracket grouping", () => {
  it("brackets produce open/close-bracket pills", () => {
    const pills = resolveNlpQuery("( count > 5 or count < 1 ) and title = hello", FIELDS);
    expect(pills).toHaveLength(7);
    expect(pills[0]).toMatchObject({ kind: "open-bracket" });
    expect(pills[4]).toMatchObject({ kind: "close-bracket" });
    expect(pills[5]).toMatchObject({ kind: "and" });
    expect(pills[6]).toMatchObject({ kind: "value", fieldName: "title" });
  });

  it("brackets with no spaces also parsed correctly", () => {
    const pills = resolveNlpQuery("(count > 5 or count < 1) and title = hello", FIELDS);
    expect(pills).toHaveLength(7);
    expect(pills[0]).toMatchObject({ kind: "open-bracket" });
    expect(pills[4]).toMatchObject({ kind: "close-bracket" });
  });

  it("bracket group containing range expression", () => {
    const pills = resolveNlpQuery("(price between 10 and 50) and count > 5", FIELDS);
    expect(pills).toHaveLength(5);
    expect(pills[0]).toMatchObject({ kind: "open-bracket" });
    expect(pills[1]).toMatchObject({ kind: "range", fieldName: "price" });
    expect(pills[2]).toMatchObject({ kind: "close-bracket" });
    expect(pills[3]).toMatchObject({ kind: "and" });
    expect(pills[4]).toMatchObject({ kind: "value", fieldName: "count" });
  });
});

describe("resolveNlpQuery â€” 'between X and Y' inner AND not treated as connector", () => {
  it("range + AND + clause â†’ 3 pills (not 5)", () => {
    const pills = resolveNlpQuery("price between 10 and 50 and count > 5", FIELDS);
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "range", fieldName: "price" });
    expect((pills[0] as RangePill).from).toBe(10);
    expect((pills[0] as RangePill).to).toBe(50);
    expect(pills[1]).toMatchObject({ kind: "and" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "count" });
  });

  it("date range between + AND clause", () => {
    const pills = resolveNlpQuery(
      "due between 2026-01-01 and 2026-12-31 and count > 5", FIELDS,
    );
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "range", fieldName: "due" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "count" });
  });

  it("multiple range + AND clauses", () => {
    const pills = resolveNlpQuery(
      "count between 1 and 10 and price between 5 and 20", FIELDS,
    );
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "range", fieldName: "count" });
    expect(pills[2]).toMatchObject({ kind: "range", fieldName: "price" });
  });
});

describe("resolveNlpQuery â€” list expressions with AND", () => {
  it("list clause followed by AND â€” commas inside list NOT split as clause separators", () => {
    const pills = resolveNlpQuery("status in New,Done and count > 5", FIELDS);
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "list", fieldName: "status", operator: "in" });
    expect((pills[0] as ListPill).values).toHaveLength(2);  // New and Done
    expect(pills[1]).toMatchObject({ kind: "and" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "count" });
  });

  it("negative list with AND", () => {
    const pills = resolveNlpQuery("status not one of New,Done and count > 5", FIELDS);
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "list", operator: "!" });
    expect((pills[0] as ListPill).values).toHaveLength(2);
  });
});

describe("resolveNlpQuery â€” comma as implicit AND (between non-list clauses)", () => {
  it("two clauses separated by comma", () => {
    const pills = resolveNlpQuery("title = hello, count > 5", FIELDS);
    expect(pills).toHaveLength(3);
    expect(pills[1]).toMatchObject({ kind: "and" });
  });

  it("three clauses separated by commas", () => {
    const pills = resolveNlpQuery("title = hello, count > 5, active = true", FIELDS);
    expect(pills).toHaveLength(5);
    expect(pills[1]).toMatchObject({ kind: "and" });
    expect(pills[3]).toMatchObject({ kind: "and" });
  });
});

describe("resolveNlpQuery â€” complex combinations", () => {
  it("range + OR + list", () => {
    const pills = resolveNlpQuery(
      "price between 10 and 50 or status in New,Done", FIELDS,
    );
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "range" });
    expect(pills[1]).toMatchObject({ kind: "or" });
    expect(pills[2]).toMatchObject({ kind: "list" });
  });

  it("(bracket group) OR value", () => {
    const pills = resolveNlpQuery(
      "(count >= 5 and count <= 10) or status = Done", FIELDS,
    );
    expect(pills[0]).toMatchObject({ kind: "open-bracket" });
    expect(pills[4]).toMatchObject({ kind: "close-bracket" });
    expect(pills[5]).toMatchObject({ kind: "or" });
    expect(pills[6]).toMatchObject({ kind: "value", fieldName: "status" });
  });

  it("all field types in a single query", () => {
    const pills = resolveNlpQuery(
      "title = hello and count > 5 and price <= 9.99 and active = true and status = Done",
      FIELDS,
    );
    expect(pills).toHaveLength(9);
    const values = pills.filter((p) => p.kind === "value") as ValuePill[];
    expect(values.map((p) => p.fieldName)).toEqual([
      "title", "count", "price", "active", "status",
    ]);
  });

  it("empty query returns empty array", () => {
    expect(resolveNlpQuery("", FIELDS)).toEqual([]);
    expect(resolveNlpQuery("   ", FIELDS)).toEqual([]);
  });

  it("empty fields returns empty array", () => {
    expect(resolveNlpQuery("count > 5", [])).toEqual([]);
  });
});


describe("resolveNlpQuery — context carry-over (non-list fields)", () => {
  // "field is x or y" → field=x OR field=y  (string, no "in" support)
  it("title is foo or bar  →  title=foo OR title=bar", () => {
    const pills = resolveNlpQuery("title is foo or bar", FIELDS);
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "value", fieldName: "title", operator: "=", value: "foo" });
    expect(pills[1]).toMatchObject({ kind: "or" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "title", operator: "=", value: "bar" });
  });

  // "field is x, y" — comma-separated same-field values become OR
  it("title is foo, bar  →  title=foo OR title=bar", () => {
    const pills = resolveNlpQuery("title is foo, bar", FIELDS);
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "value", fieldName: "title", operator: "=", value: "foo" });
    expect(pills[1]).toMatchObject({ kind: "or" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "title", operator: "=", value: "bar" });
  });

  // "field is x, y or z" — both comma and or become OR for same field
  it("title is foo, bar or baz  →  title=foo OR title=bar OR title=baz", () => {
    const pills = resolveNlpQuery("title is foo, bar or baz", FIELDS);
    expect(pills).toHaveLength(5);
    expect(pills[0]).toMatchObject({ kind: "value", fieldName: "title", value: "foo" });
    expect(pills[1]).toMatchObject({ kind: "or" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "title", value: "bar" });
    expect(pills[3]).toMatchObject({ kind: "or" });
    expect(pills[4]).toMatchObject({ kind: "value", fieldName: "title", value: "baz" });
  });

  // "field x, y or z" — no explicit operator; default op is used throughout
  it("title foo, bar or baz  →  title[op]foo OR title[op]bar OR title[op]baz", () => {
    const pills = resolveNlpQuery("title foo, bar or baz", FIELDS);
    expect(pills).toHaveLength(5);
    expect(pills[0]).toMatchObject({ kind: "value", fieldName: "title", value: "foo" });
    expect(pills[1]).toMatchObject({ kind: "or" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "title", value: "bar" });
    expect(pills[3]).toMatchObject({ kind: "or" });
    expect(pills[4]).toMatchObject({ kind: "value", fieldName: "title", value: "baz" });
  });

  // Integer field — "count > 5 or 10" → count>5 OR count>10
  it("count > 5 or 10  →  count>5 OR count>10", () => {
    const pills = resolveNlpQuery("count > 5 or 10", FIELDS);
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "value", fieldName: "count", operator: ">", value: 5 });
    expect(pills[1]).toMatchObject({ kind: "or" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "count", operator: ">", value: 10 });
  });

  // Integer field with comma list — "count is 5, 10, 20" → count=5 OR count=10 OR count=20
  it("count is 5, 10, 20  →  count=5 OR count=10 OR count=20", () => {
    const pills = resolveNlpQuery("count is 5, 10, 20", FIELDS);
    expect(pills).toHaveLength(5);
    expect(pills[0]).toMatchObject({ kind: "value", fieldName: "count", operator: "=", value: 5 });
    expect(pills[1]).toMatchObject({ kind: "or" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "count", operator: "=", value: 10 });
    expect(pills[3]).toMatchObject({ kind: "or" });
    expect(pills[4]).toMatchObject({ kind: "value", fieldName: "count", operator: "=", value: 20 });
  });

  // AND resets context — bare value after AND falls back to normal inference
  it("title is foo or bar and count > 5  →  context resets at AND", () => {
    const pills = resolveNlpQuery("title is foo or bar and count > 5", FIELDS);
    // title=foo OR title=bar AND count>5
    expect(pills).toHaveLength(5);
    expect(pills[0]).toMatchObject({ kind: "value", fieldName: "title", value: "foo" });
    expect(pills[1]).toMatchObject({ kind: "or" });
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "title", value: "bar" });
    expect(pills[3]).toMatchObject({ kind: "and" });
    expect(pills[4]).toMatchObject({ kind: "value", fieldName: "count" });
  });

  // Set fields have "in" operator — no carry-over; value-inference handles them
  it("set field 'status is New or Done' — each value resolved independently (no carry-over)", () => {
    const pills = resolveNlpQuery("status is New or Done", FIELDS);
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatchObject({ kind: "value", fieldName: "status", value: "New" });
    expect(pills[1]).toMatchObject({ kind: "or" });
    // "Done" resolved via set-value inference (not carry-over)
    expect(pills[2]).toMatchObject({ kind: "value", fieldName: "status", value: "Done" });
  });
});

// ─── DATE WORD RESOLUTION (resolveDatePhrase) ──────────────────────────────

/** ISO date regex: yyyy-MM-dd */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** ISO datetime regex: yyyy-MM-dd HH:mm:ss */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** Helper used only within the date-word tests */
function isoDateOnly(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

describe("resolveDatePhrase — single-point keywords (date mode)", () => {
  it("'now' => single datetime value, no rangeEnd", () => {
    const r = resolveDatePhrase("now");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATETIME);
    expect(r!.rangeEnd).toBeUndefined();
  });

  it("'today' => date range covering whole day", () => {
    const r = resolveDatePhrase("today");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    expect(r!.rangeEnd).toMatch(ISO_DATE);
    expect(r!.value).toBe(r!.rangeEnd);
  });

  it("'yesterday' => date range one day before today", () => {
    const r = resolveDatePhrase("yesterday");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    expect(r!.rangeEnd).toMatch(ISO_DATE);
    const d = new Date(); d.setDate(d.getDate() - 1);
    expect(r!.value).toBe(isoDateOnly(d));
  });

  it("'tomorrow' => date range one day after today", () => {
    const r = resolveDatePhrase("tomorrow");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    const d = new Date(); d.setDate(d.getDate() + 1);
    expect(r!.value).toBe(isoDateOnly(d));
  });
});

describe("resolveDatePhrase — week ranges (date mode)", () => {
  it("'this week' => range spanning Mon-Sun of current week", () => {
    const r = resolveDatePhrase("this week");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    expect(r!.rangeEnd).toMatch(ISO_DATE);
    expect(r!.value! <= r!.rangeEnd!).toBe(true);
  });

  it("'last week' => range entirely before this week's start", () => {
    const thisWeek = resolveDatePhrase("this week");
    const r = resolveDatePhrase("last week");
    expect(r).toBeDefined();
    expect(r!.rangeEnd! < thisWeek!.value!).toBe(true);
  });

  it("'next week' => range entirely after this week's end", () => {
    const thisWeek = resolveDatePhrase("this week");
    const r = resolveDatePhrase("next week");
    expect(r).toBeDefined();
    expect(r!.value! > thisWeek!.rangeEnd!).toBe(true);
  });
});

describe("resolveDatePhrase — month ranges (date mode)", () => {
  it("'this month' => range from 1st to last day of current month", () => {
    const r = resolveDatePhrase("this month");
    expect(r).toBeDefined();
    expect(r!.value!.endsWith("-01")).toBe(true);
    expect(r!.rangeEnd).toMatch(ISO_DATE);
  });

  it("'last month' => range entirely before this month", () => {
    const thisMonth = resolveDatePhrase("this month");
    const r = resolveDatePhrase("last month");
    expect(r).toBeDefined();
    expect(r!.rangeEnd! < thisMonth!.value!).toBe(true);
  });

  it("'next month' => range entirely after this month", () => {
    const thisMonth = resolveDatePhrase("this month");
    const r = resolveDatePhrase("next month");
    expect(r).toBeDefined();
    expect(r!.value! > thisMonth!.rangeEnd!).toBe(true);
  });
});

describe("resolveDatePhrase — year ranges (date mode)", () => {
  it("'this year' => range Jan 1 - Dec 31 of current year", () => {
    const year = new Date().getFullYear();
    const r = resolveDatePhrase("this year");
    expect(r).toBeDefined();
    expect(r!.value).toBe(`${year}-01-01`);
    expect(r!.rangeEnd).toBe(`${year}-12-31`);
  });

  it("'last year' => range Jan 1 - Dec 31 of previous year", () => {
    const year = new Date().getFullYear() - 1;
    const r = resolveDatePhrase("last year");
    expect(r).toBeDefined();
    expect(r!.value).toBe(`${year}-01-01`);
    expect(r!.rangeEnd).toBe(`${year}-12-31`);
  });

  it("'next year' => range Jan 1 - Dec 31 of next year", () => {
    const year = new Date().getFullYear() + 1;
    const r = resolveDatePhrase("next year");
    expect(r).toBeDefined();
    expect(r!.value).toBe(`${year}-01-01`);
    expect(r!.rangeEnd).toBe(`${year}-12-31`);
  });
});

describe("resolveDatePhrase — business phrases", () => {
  it("'this quarter' => quarter range", () => {
    const r = resolveDatePhrase("this quarter");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    expect(r!.rangeEnd).toMatch(ISO_DATE);
    expect(r!.value! <= r!.rangeEnd!).toBe(true);
  });

  it("'last quarter' => range before this quarter", () => {
    const thisQuarter = resolveDatePhrase("this quarter");
    const r = resolveDatePhrase("last quarter");
    expect(r).toBeDefined();
    expect(r!.rangeEnd! < thisQuarter!.value!).toBe(true);
  });

  it("'this sprint' => 14-day range", () => {
    const r = resolveDatePhrase("this sprint");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    expect(r!.rangeEnd).toMatch(ISO_DATE);
    const spanDays =
      (Date.parse(`${r!.rangeEnd}T00:00:00`) - Date.parse(`${r!.value}T00:00:00`)) /
      (24 * 60 * 60 * 1000);
    expect(spanDays).toBe(13);
  });

  it("'next business day' => single-business-day range", () => {
    const r = resolveDatePhrase("next business day");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    expect(r!.rangeEnd).toMatch(ISO_DATE);
    expect(r!.value).toBe(r!.rangeEnd);
  });

  it("'Next Monday.' => weekday day-range", () => {
    const r = resolveDatePhrase("Next Monday.");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    expect(r!.rangeEnd).toMatch(ISO_DATE);
    const weekday = new Date(`${r!.value}T00:00:00`).getDay();
    expect(weekday).toBe(1);
  });

  it("'Next week.' => same as next week phrase without punctuation", () => {
    const punctuated = resolveDatePhrase("Next week.");
    const plain = resolveDatePhrase("next week");
    expect(punctuated).toBeDefined();
    expect(plain).toBeDefined();
    expect(punctuated!.value).toBe(plain!.value);
    expect(punctuated!.rangeEnd).toBe(plain!.rangeEnd);
  });

  it("'in a fortnight' => date 14 days in future", () => {
    const r = resolveDatePhrase("in a fortnight");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    expect(r!.rangeEnd).toMatch(ISO_DATE);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    expect(r!.value).toBe(isoDateOnly(d));
  });
});

describe("resolveDatePhrase — relative N-unit phrases (date mode)", () => {
  it("'3 days ago' => single date value 3 days in the past", () => {
    const r = resolveDatePhrase("3 days ago");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    expect(r!.rangeEnd).toBeUndefined();
    const d = new Date(); d.setDate(d.getDate() - 3);
    expect(r!.value).toBe(isoDateOnly(d));
  });

  it("'in 5 days' => single date value 5 days in the future", () => {
    const r = resolveDatePhrase("in 5 days");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    const d = new Date(); d.setDate(d.getDate() + 5);
    expect(r!.value).toBe(isoDateOnly(d));
  });

  it("'2 weeks ago' => single date ~14 days in the past", () => {
    const r = resolveDatePhrase("2 weeks ago");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    const d = new Date(); d.setDate(d.getDate() - 14);
    expect(r!.value).toBe(isoDateOnly(d));
  });

  it("'in 1 week' => single date 7 days in the future", () => {
    const r = resolveDatePhrase("in 1 week");
    expect(r).toBeDefined();
    const d = new Date(); d.setDate(d.getDate() + 7);
    expect(r!.value).toBe(isoDateOnly(d));
  });

  it("'1 month ago' => single date value", () => {
    const r = resolveDatePhrase("1 month ago");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
  });

  it("'in 3 months' => single date 3 months in the future", () => {
    const r = resolveDatePhrase("in 3 months");
    expect(r).toBeDefined();
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    expect(r!.value).toBe(isoDateOnly(d));
  });

  it("'2 years ago' => single date value", () => {
    const r = resolveDatePhrase("2 years ago");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
    const d = new Date(); d.setFullYear(d.getFullYear() - 2);
    expect(r!.value).toBe(isoDateOnly(d));
  });

  it("'in 1 year' => single date value in the future", () => {
    const r = resolveDatePhrase("in 1 year");
    expect(r).toBeDefined();
    expect(r!.value).toMatch(ISO_DATE);
  });
});

describe("resolveDatePhrase — datetime mode (forDatetime = true)", () => {
  it("'now' => ISO datetime string", () => {
    expect(resolveDatePhrase("now", true)!.value).toMatch(ISO_DATETIME);
  });

  it("'today' => datetime range, start 00:00:00 end 23:59:59", () => {
    const r = resolveDatePhrase("today", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
    expect(r.rangeEnd).toMatch(ISO_DATETIME);
    expect(r.value!.endsWith("00:00:00")).toBe(true);
    expect(r.rangeEnd!.endsWith("23:59:59")).toBe(true);
  });

  it("'yesterday' => datetime range", () => {
    const r = resolveDatePhrase("yesterday", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
    expect(r.rangeEnd).toMatch(ISO_DATETIME);
  });

  it("'last week' => datetime range", () => {
    const r = resolveDatePhrase("last week", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
    expect(r.rangeEnd).toMatch(ISO_DATETIME);
  });

  it("'next year' => datetime range", () => {
    const r = resolveDatePhrase("next year", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
    expect(r.rangeEnd).toMatch(ISO_DATETIME);
  });

  it("'3 days ago' => single datetime value", () => {
    const r = resolveDatePhrase("3 days ago", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
    expect(r.rangeEnd).toBeUndefined();
  });
});

describe("resolveDatePhrase — unrecognised phrases return undefined", () => {
  it("empty string => undefined", () => {
    expect(resolveDatePhrase("")).toBeUndefined();
  });

  it("random word => undefined", () => {
    expect(resolveDatePhrase("blahblah")).toBeUndefined();
  });

  it("'soon' => undefined", () => {
    expect(resolveDatePhrase("soon")).toBeUndefined();
  });
});

describe("date word phrases via resolveNlpExpression (integration)", () => {
  it("'due = today' => RangePill", () => {
    const p = resolve("due = today") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.from).toMatch(ISO_DATE);
    expect(p.to).toMatch(ISO_DATE);
  });

  it("'due = yesterday' => RangePill", () => {
    expect((resolve("due = yesterday") as RangePill).kind).toBe("range");
  });

  it("'due = tomorrow' => RangePill", () => {
    expect((resolve("due = tomorrow") as RangePill).kind).toBe("range");
  });

  it("'due = last week' => RangePill", () => {
    expect((resolve("due = last week") as RangePill).kind).toBe("range");
  });

  it("'due = next week' => RangePill", () => {
    expect((resolve("due = next week") as RangePill).kind).toBe("range");
  });

  it("'due = last month' => RangePill", () => {
    expect((resolve("due = last month") as RangePill).kind).toBe("range");
  });

  it("'due = next month' => RangePill", () => {
    expect((resolve("due = next month") as RangePill).kind).toBe("range");
  });

  it("'due = last year' => RangePill with correct year", () => {
    const p = resolve("due = last year") as RangePill;
    expect(p.kind).toBe("range");
    const year = new Date().getFullYear() - 1;
    expect((p.from as string).startsWith(`${year}-`)).toBe(true);
  });

  it("'due = next year' => RangePill with correct year", () => {
    const p = resolve("due = next year") as RangePill;
    expect(p.kind).toBe("range");
    const year = new Date().getFullYear() + 1;
    expect((p.from as string).startsWith(`${year}-`)).toBe(true);
  });

  it("'due > 3 days ago' => ValuePill with date in the past", () => {
    const p = resolve("due > 3 days ago") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.operator).toBe(">");
    expect(p.value).toMatch(ISO_DATE);
  });

  it("'due < in 2 weeks' => ValuePill with date in the future", () => {
    const p = resolve("due < in 2 weeks") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.operator).toBe("<");
    expect(p.value).toMatch(ISO_DATE);
  });

  it("'created = now' => ValuePill with datetime string", () => {
    const p = resolve("created = now") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.value).toMatch(ISO_DATETIME);
  });

  it("'created = today' => RangePill with datetime strings", () => {
    const p = resolve("created = today") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.from).toMatch(ISO_DATETIME);
    expect(p.to).toMatch(ISO_DATETIME);
  });

  it("'created = last week' => RangePill with datetime strings", () => {
    const p = resolve("created = last week") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.from).toMatch(ISO_DATETIME);
    expect(p.to).toMatch(ISO_DATETIME);
  });

  it("'created = next year' => RangePill with datetime strings", () => {
    const p = resolve("created = next year") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.from).toMatch(ISO_DATETIME);
    expect(p.to).toMatch(ISO_DATETIME);
  });

  it("'due tomorrow' (no operator) => ValuePill with tomorrow's date", () => {
    const p = resolve("due tomorrow") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.operator).toBe("=");
    expect(p.value).toMatch(ISO_DATE);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(p.value as string).toBe(isoDateOnly(tomorrow));
  });

  it("'due today' (no operator) => ValuePill with today's date", () => {
    const p = resolve("due today") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.operator).toBe("=");
    expect(p.value as string).toBe(isoDateOnly(new Date()));
  });

  it("'due = tomorrow' (explicit operator) => RangePill", () => {
    const p = resolve("due = tomorrow") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.from).toMatch(ISO_DATE);
    expect(p.to).toMatch(ISO_DATE);
  });

  it("'due between Monday and Friday' => weekday-bounded RangePill", () => {
    const p = resolve("due between Monday and Friday") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("due");
    expect(p.from).toMatch(ISO_DATE);
    expect(p.to).toMatch(ISO_DATE);
    expect(new Date(`${String(p.from)}T00:00:00`).getDay()).toBe(1);
    expect(new Date(`${String(p.to)}T00:00:00`).getDay()).toBe(5);
  });

  it("'due between torrow and next week.' => typo+punc tolerant range", () => {
    const p = resolve("due between torrow and next week.") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.fieldName).toBe("due");
    expect(p.from).toMatch(ISO_DATE);
    expect(p.to).toMatch(ISO_DATE);
    expect(String(p.from) <= String(p.to)).toBe(true);
  });

  it("'due = Next Monday.' => RangePill", () => {
    const p = resolve("due = Next Monday.") as RangePill;
    expect(p.kind).toBe("range");
    expect(new Date(`${String(p.from)}T00:00:00`).getDay()).toBe(1);
  });

  it("'due = in a fortnight' => RangePill for 14-days-out date", () => {
    const p = resolve("due = in a fortnight") as RangePill;
    expect(p.kind).toBe("range");
    const d = new Date();
    d.setDate(d.getDate() + 14);
    expect(p.from).toBe(isoDateOnly(d));
  });
});

describe("resolveDatePhrase — a/an quantity", () => {
  it("'in a year' => 1 year from now", () => {
    const r = resolveDatePhrase("in a year")!;
    const expected = new Date();
    expected.setFullYear(expected.getFullYear() + 1);
    expect(r.value).toMatch(ISO_DATE);
    expect(r.value).toBe(isoDateOnly(expected));
  });

  it("'in an hour' => 1 hour from now (datetime)", () => {
    const r = resolveDatePhrase("in an hour", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
  });

  it("'a week ago' => 1 week in the past", () => {
    const r = resolveDatePhrase("a week ago")!;
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);
    expect(r.value).toBe(isoDateOnly(expected));
  });

  it("'in a month' => 1 month from now", () => {
    const r = resolveDatePhrase("in a month")!;
    const expected = new Date();
    expected.setMonth(expected.getMonth() + 1);
    expect(r.value).toBe(isoDateOnly(expected));
  });

  it("'a day ago' => yesterday", () => {
    const r = resolveDatePhrase("a day ago")!;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(r.value).toBe(isoDateOnly(yesterday));
  });

  it("'3 months from now' => 3 months ahead", () => {
    const r = resolveDatePhrase("3 months from now")!;
    const expected = new Date();
    expected.setMonth(expected.getMonth() + 3);
    expect(r.value).toBe(isoDateOnly(expected));
  });

  it("'a year from now' => 1 year ahead", () => {
    const r = resolveDatePhrase("a year from now")!;
    const expected = new Date();
    expected.setFullYear(expected.getFullYear() + 1);
    expect(r.value).toBe(isoDateOnly(expected));
  });
});

describe("resolveDatePhrase — next/last/past N units (ranges)", () => {
  it("'next 2 weeks' => range from today to 2 weeks ahead", () => {
    const r = resolveDatePhrase("next 2 weeks")!;
    expect(r.value).toMatch(ISO_DATE);
    expect(r.rangeEnd).toMatch(ISO_DATE);
    const today = isoDateOnly(new Date());
    expect(r.value).toBe(today);
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
    expect(r.rangeEnd).toBe(isoDateOnly(twoWeeksLater));
  });

  it("'last 3 months' => range from 3 months ago to today", () => {
    const r = resolveDatePhrase("last 3 months")!;
    expect(r.value).toMatch(ISO_DATE);
    expect(r.rangeEnd).toMatch(ISO_DATE);
    const today = isoDateOnly(new Date());
    expect(r.rangeEnd).toBe(today);
  });

  it("'past 30 days' => range from 30 days ago to today", () => {
    const r = resolveDatePhrase("past 30 days")!;
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    expect(r.value).toBe(isoDateOnly(thirtyAgo));
    expect(r.rangeEnd).toBe(isoDateOnly(new Date()));
  });

  it("'the next 6 months' => range from today to 6 months ahead", () => {
    const r = resolveDatePhrase("the next 6 months")!;
    expect(r.value).toMatch(ISO_DATE);
    expect(r.rangeEnd).toMatch(ISO_DATE);
    expect(r.value).toBe(isoDateOnly(new Date()));
  });

  it("'the last 2 years' => range from 2 years ago to today", () => {
    const r = resolveDatePhrase("the last 2 years")!;
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    expect(r.value).toBe(isoDateOnly(twoYearsAgo));
    expect(r.rangeEnd).toBe(isoDateOnly(new Date()));
  });

  it("'next a week' (a=1) => range", () => {
    const r = resolveDatePhrase("next a week")!;
    expect(r.value).toMatch(ISO_DATE);
    expect(r.rangeEnd).toMatch(ISO_DATE);
  });

  it("'next 2 weeks' datetime mode => ISO datetime strings", () => {
    const r = resolveDatePhrase("next 2 weeks", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
    expect(r.rangeEnd).toMatch(ISO_DATETIME);
  });

  it("'last 3 months' datetime mode => ISO datetime strings", () => {
    const r = resolveDatePhrase("last 3 months", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
    expect(r.rangeEnd).toMatch(ISO_DATETIME);
  });
});

describe("resolveDatePhrase — hours and minutes", () => {
  it("'in 2 hours' => 2 hours from now (datetime)", () => {
    const r = resolveDatePhrase("in 2 hours", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
  });

  it("'30 minutes ago' => 30 minutes in the past (datetime)", () => {
    const r = resolveDatePhrase("30 minutes ago", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
  });

  it("'in an hour' => 1 hour from now (datetime)", () => {
    const r = resolveDatePhrase("in an hour", true)!;
    expect(r.value).toMatch(ISO_DATETIME);
  });
});

describe("NLP expression — date-field multi-word operator slot", () => {
  it("'due next 2 weeks' => RangePill", () => {
    const p = resolve("due next 2 weeks") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.from).toMatch(ISO_DATE);
    expect(p.to).toMatch(ISO_DATE);
  });

  it("'due last 3 months' => RangePill", () => {
    const p = resolve("due last 3 months") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.from).toMatch(ISO_DATE);
    expect(p.to).toMatch(ISO_DATE);
  });

  it("'due past 30 days' => RangePill", () => {
    const p = resolve("due past 30 days") as RangePill;
    expect(p.kind).toBe("range");
    expect(p.from).toMatch(ISO_DATE);
    expect(p.to).toMatch(ISO_DATE);
  });

  it("'due next week' => RangePill (via operator-slot fallback)", () => {
    const p = resolve("due next week") as RangePill;
    expect(p.kind).toBe("range");
  });

  it("'due in a year' => ValuePill with date 1 year from now", () => {
    const p = resolve("due in a year") as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.value).toMatch(ISO_DATE);
  });

  it("'due in an hour' (datetime field) => ValuePill", () => {
    const datetimeFields = [{ name: "created", type: "datetime" as const, precedence: 10 }];
    const p = resolveNlpExpression("created in an hour", datetimeFields) as ValuePill;
    expect(p.kind).toBe("value");
    expect(p.value).toMatch(ISO_DATETIME);
  });
});

// ── wordsToNumber ─────────────────────────────────────────────────────────────

describe("wordsToNumber — basic words", () => {
  it.each([
    ["zero", 0],
    ["one", 1],
    ["five", 5],
    ["twelve", 12],
    ["nineteen", 19],
    ["twenty", 20],
    ["ninety", 90],
  ] as [string, number][])("%s => %d", (word, expected) => {
    expect(wordsToNumber(word)).toBe(expected);
  });

  it("'twenty-two' (hyphenated) => 22", () => expect(wordsToNumber("twenty-two")).toBe(22));
  it("'thirty five' (space) => 35", () => expect(wordsToNumber("thirty five")).toBe(35));
  it("'fifty-nine' => 59", () => expect(wordsToNumber("fifty-nine")).toBe(59));
  it("'a couple' => 2", () => expect(wordsToNumber("a couple")).toBe(2));
  it("'a dozen' => 12", () => expect(wordsToNumber("a dozen")).toBe(12));
  it("'half' => 0.5", () => expect(wordsToNumber("half")).toBe(0.5));
});

describe("wordsToNumber — hundreds and thousands", () => {
  it("'one hundred' => 100", () => expect(wordsToNumber("one hundred")).toBe(100));
  it("'two hundred fifty' => 250", () => expect(wordsToNumber("two hundred fifty")).toBe(250));
  it("'one hundred and five' => 105", () => expect(wordsToNumber("one hundred and five")).toBe(105));
  it("'three hundred' => 300", () => expect(wordsToNumber("three hundred")).toBe(300));
  it("'a thousand' => 1000", () => expect(wordsToNumber("a thousand")).toBe(1000));
  it("'three thousand' => 3000", () => expect(wordsToNumber("three thousand")).toBe(3000));
  it("'three thousand two hundred forty five' => 3245", () =>
    expect(wordsToNumber("three thousand two hundred forty five")).toBe(3245));
  it("'one million' => 1_000_000", () => expect(wordsToNumber("one million")).toBe(1_000_000));
  it("'2 million' (digit mixed) => 2_000_000", () => expect(wordsToNumber("2 million")).toBe(2_000_000));
});

describe("wordsToNumber — negative and decimal", () => {
  it("'minus five' => -5", () => expect(wordsToNumber("minus five")).toBe(-5));
  it("'negative ten' => -10", () => expect(wordsToNumber("negative ten")).toBe(-10));
  it("'three point five' => 3.5", () => expect(wordsToNumber("three point five")).toBe(3.5));
  it("'one point two five' => 1.25", () => expect(wordsToNumber("one point two five")).toBe(1.25));
});

describe("wordsToNumber — unrecognised input returns undefined", () => {
  it.each(["blah", "foobar", "maybe", "asap", ""])("%s => undefined", (word) => {
    expect(wordsToNumber(word)).toBeUndefined();
  });
});

// ── Word numbers via NLP resolver ─────────────────────────────────────────────

describe("NLP resolver — word-to-number on integer field", () => {
  const intField: FieldDefinition = { name: "priority", type: "integer", precedence: 1 };
  const resolve = (q: string) => resolveNlpExpression(q, [intField]) as ValuePill;

  it("'priority five' => value 5", () => {
    const p = resolve("priority five");
    expect(p.kind).toBe("value");
    expect(p.value).toBe(5);
    expect(p.invalid).toBeFalsy();
  });

  it("'priority is twenty-two' => value 22", () => {
    const p = resolve("priority is twenty-two");
    expect(p.value).toBe(22);
    expect(p.invalid).toBeFalsy();
  });

  it("'priority three hundred' => value 300", () => {
    const p = resolve("priority three hundred");
    expect(p.value).toBe(300);
    expect(p.invalid).toBeFalsy();
  });

  it("'priority minus seven' => value -7", () => {
    const p = resolve("priority minus seven");
    expect(p.value).toBe(-7);
    expect(p.invalid).toBeFalsy();
  });

  it("'priority foobar' => invalid pill", () => {
    const p = resolve("priority foobar");
    expect(p.invalid).toBe(true);
  });
});

describe("NLP resolver — word-to-number on float field", () => {
  const floatField: FieldDefinition = { name: "cost", type: "float", precedence: 1 };
  const resolve = (q: string) => resolveNlpExpression(q, [floatField]) as ValuePill;

  it("'cost three point five' => value 3.5", () => {
    const p = resolve("cost three point five");
    expect(p.value).toBe(3.5);
    expect(p.invalid).toBeFalsy();
  });

  it("'cost half' => value 0.5", () => {
    const p = resolve("cost half");
    expect(p.value).toBe(0.5);
    expect(p.invalid).toBeFalsy();
  });

  it("'cost free' => invalid pill", () => {
    const p = resolve("cost free");
    expect(p.invalid).toBe(true);
  });
});

// ── Invalid pill marking ──────────────────────────────────────────────────────

describe("NLP resolver — invalid pill for non-matching values", () => {
  it("integer field with non-numeric text => invalid", () => {
    const fields: FieldDefinition[] = [{ name: "qty", type: "integer", precedence: 1 }];
    const p = resolveNlpExpression("qty asap", fields) as ValuePill;
    expect(p.invalid).toBe(true);
  });

  it("float field with non-numeric text => invalid", () => {
    const fields: FieldDefinition[] = [{ name: "price", type: "float", precedence: 1 }];
    const p = resolveNlpExpression("price free", fields) as ValuePill;
    expect(p.invalid).toBe(true);
  });

  it("integer field with numeric value => not invalid", () => {
    const fields: FieldDefinition[] = [{ name: "qty", type: "integer", precedence: 1 }];
    const p = resolveNlpExpression("qty 5", fields) as ValuePill;
    expect(p.invalid).toBeFalsy();
  });

  it("set field with unknown value and known set => invalid", () => {
    const fields: FieldDefinition[] = [
      { name: "state", type: "set", setValues: ["New", "Done", "Blocked"], precedence: 1 },
    ];
    const p = resolveNlpExpression("state = Pending", fields) as ValuePill;
    expect(p.invalid).toBe(true);
  });

  it("set field with known value => not invalid", () => {
    const fields: FieldDefinition[] = [
      { name: "state", type: "set", setValues: ["New", "Done", "Blocked"], precedence: 1 },
    ];
    const p = resolveNlpExpression("state = New", fields) as ValuePill;
    expect(p.invalid).toBeFalsy();
  });

  it("set field with async values and setValuesByField => invalid when not in list", () => {
    const fields: FieldDefinition[] = [
      { name: "state", type: "set", precedence: 1 },
    ];
    const p = resolveNlpExpression(
      "state = Pending",
      fields,
      { setValuesByField: { state: ["New", "Done", "Blocked"] } },
    ) as ValuePill;
    expect(p.invalid).toBe(true);
  });
});