/**
 * operators.test.ts
 *
 * Comprehensive tests for all exports from operators.ts:
 *   - operatorsForField / operatorsForType
 *   - defaultOperatorForType
 *   - findLeadingOperator
 *   - isPlausibleValue
 *   - isValidValue
 */

import { describe, expect, it } from "vitest";
import {
  defaultOperatorForType,
  findLeadingOperator,
  isPlausibleValue,
  isValidValue,
  OPERATOR_ORDER,
  operatorsForField,
  operatorsForType,
} from "./operators";
import type { FieldDefinition } from "./types";

// ── Shared field fixtures ───────────────────────────────────────────────────

const stringField: FieldDefinition = { name: "title", type: "string", precedence: 1 };
const intField: FieldDefinition = { name: "count", type: "integer", precedence: 2 };
const floatField: FieldDefinition = { name: "price", type: "float", precedence: 3 };
const dateField: FieldDefinition = { name: "due", type: "date", precedence: 4 };
const datetimeField: FieldDefinition = { name: "created", type: "datetime", precedence: 5 };
const boolField: FieldDefinition = { name: "active", type: "boolean", precedence: 6 };
const setField: FieldDefinition = { name: "status", type: "set", precedence: 7, setValues: ["New", "Done"] };
const customField: FieldDefinition = {
  name: "custom",
  type: "custom",
  translate: (v) => v,
  operators: ["=", "!", ">", "myop"],
  precedence: 8,
};

// ── operatorsForType ─────────────────────────────────────────────────────────

describe("operatorsForType", () => {
  it("string returns 6 operators including wildcard variants", () => {
    expect(operatorsForType("string")).toEqual(["=", "!", "*", "!*", "<*", ">*"]);
  });

  it("integer returns compare operators", () => {
    expect(operatorsForType("integer")).toEqual(["=", "!", ">", "<", ">=", "<="]);
  });

  it("float returns compare operators", () => {
    expect(operatorsForType("float")).toEqual(["=", "!", ">", "<", ">=", "<="]);
  });

  it("date returns compare operators", () => {
    expect(operatorsForType("date")).toEqual(["=", "!", ">", "<", ">=", "<="]);
  });

  it("datetime returns compare operators", () => {
    expect(operatorsForType("datetime")).toEqual(["=", "!", ">", "<", ">=", "<="]);
  });

  it("boolean returns = and !", () => {
    expect(operatorsForType("boolean")).toEqual(["=", "!"]);
  });

  it("set returns =, !, and in", () => {
    expect(operatorsForType("set")).toEqual(["=", "!", "in"]);
  });

  it("custom returns ['='] as default fallback", () => {
    expect(operatorsForType("custom")).toEqual(["="]);
  });
});

// ── operatorsForField ────────────────────────────────────────────────────────

describe("operatorsForField", () => {
  it("delegates to operatorsForType for standard fields", () => {
    expect(operatorsForField(stringField)).toEqual(operatorsForType("string"));
    expect(operatorsForField(intField)).toEqual(operatorsForType("integer"));
    expect(operatorsForField(floatField)).toEqual(operatorsForType("float"));
    expect(operatorsForField(dateField)).toEqual(operatorsForType("date"));
    expect(operatorsForField(datetimeField)).toEqual(operatorsForType("datetime"));
    expect(operatorsForField(boolField)).toEqual(operatorsForType("boolean"));
    expect(operatorsForField(setField)).toEqual(operatorsForType("set"));
  });

  it("uses custom field operators list when defined", () => {
    expect(operatorsForField(customField)).toEqual(["=", "!", ">", "myop"]);
  });

  it("custom field with empty operators array falls back to ['=']", () => {
    const emptyCustom: FieldDefinition = {
      name: "empty",
      type: "custom",
      translate: (v) => v,
      operators: [],
      precedence: 9,
    };
    expect(operatorsForField(emptyCustom)).toEqual(["="]);
  });
});

// ── defaultOperatorForType ───────────────────────────────────────────────────

describe("defaultOperatorForType", () => {
  it("string defaults to *", () => {
    expect(defaultOperatorForType("string")).toBe("*");
  });

  it("integer defaults to =", () => {
    expect(defaultOperatorForType("integer")).toBe("=");
  });

  it("float defaults to =", () => {
    expect(defaultOperatorForType("float")).toBe("=");
  });

  it("date defaults to =", () => {
    expect(defaultOperatorForType("date")).toBe("=");
  });

  it("datetime defaults to =", () => {
    expect(defaultOperatorForType("datetime")).toBe("=");
  });

  it("boolean defaults to =", () => {
    expect(defaultOperatorForType("boolean")).toBe("=");
  });

  it("set defaults to =", () => {
    expect(defaultOperatorForType("set")).toBe("=");
  });

  it("custom defaults to =", () => {
    expect(defaultOperatorForType("custom")).toBe("=");
  });
});

// ── OPERATOR_ORDER (sanity check) ────────────────────────────────────────────

describe("OPERATOR_ORDER", () => {
  it("has longer operators before shorter ones to prevent prefix mis-match", () => {
    const idx = (op: string) => OPERATOR_ORDER.indexOf(op);
    // >= must come before > and =
    expect(idx(">=")).toBeLessThan(idx(">"));
    expect(idx(">=")).toBeLessThan(idx("="));
    // <= must come before < and =
    expect(idx("<=")).toBeLessThan(idx("<"));
    expect(idx("<=")).toBeLessThan(idx("="));
    // !* before !
    expect(idx("!*")).toBeLessThan(idx("!"));
  });
});

// ── findLeadingOperator ──────────────────────────────────────────────────────

describe("findLeadingOperator", () => {
  it("detects >= at start", () => {
    expect(findLeadingOperator(">= 5")).toEqual({ op: ">=", rest: "5" });
  });

  it("detects <= at start", () => {
    expect(findLeadingOperator("<= 10")).toEqual({ op: "<=", rest: "10" });
  });

  it("detects !* at start", () => {
    expect(findLeadingOperator("!* bug")).toEqual({ op: "!*", rest: "bug" });
  });

  it("detects <* at start", () => {
    expect(findLeadingOperator("<* AP")).toEqual({ op: "<*", rest: "AP" });
  });

  it("detects >* at start", () => {
    expect(findLeadingOperator(">* ing")).toEqual({ op: ">*", rest: "ing" });
  });

  it("detects = at start", () => {
    expect(findLeadingOperator("= hello")).toEqual({ op: "=", rest: "hello" });
  });

  it("detects ! at start", () => {
    expect(findLeadingOperator("! spam")).toEqual({ op: "!", rest: "spam" });
  });

  it("detects > at start", () => {
    expect(findLeadingOperator("> 100")).toEqual({ op: ">", rest: "100" });
  });

  it("detects < at start", () => {
    expect(findLeadingOperator("< 50")).toEqual({ op: "<", rest: "50" });
  });

  it("detects * at start", () => {
    expect(findLeadingOperator("* text")).toEqual({ op: "*", rest: "text" });
  });

  it("detects in at start", () => {
    expect(findLeadingOperator("in value")).toEqual({ op: "in", rest: "value" });
  });

  it("returns no op when no operator prefix", () => {
    expect(findLeadingOperator("hello world")).toEqual({ op: undefined, rest: "hello world" });
  });

  it("trims leading whitespace before detecting operator", () => {
    expect(findLeadingOperator("  = foo")).toEqual({ op: "=", rest: "foo" });
  });

  it("returns empty rest when operator is only content", () => {
    const result = findLeadingOperator("=");
    expect(result.op).toBe("=");
    expect(result.rest).toBe("");
  });
});

// ── isPlausibleValue ─────────────────────────────────────────────────────────

describe("isPlausibleValue", () => {
  it("returns false for empty string on any field", () => {
    expect(isPlausibleValue(stringField, "")).toBe(false);
    expect(isPlausibleValue(intField, "")).toBe(false);
  });

  it("string: any non-empty value is plausible", () => {
    expect(isPlausibleValue(stringField, "hello")).toBe(true);
    expect(isPlausibleValue(stringField, "123")).toBe(true);
    expect(isPlausibleValue(stringField, " ")).toBe(true);
  });

  it("custom: any non-empty value is plausible", () => {
    expect(isPlausibleValue(customField, "anything")).toBe(true);
  });

  it("boolean: true/false/yes/no/1/0 are plausible (case insensitive)", () => {
    for (const v of ["true", "false", "yes", "no", "1", "0", "TRUE", "FALSE", "YES", "NO"]) {
      expect(isPlausibleValue(boolField, v)).toBe(true);
    }
    expect(isPlausibleValue(boolField, "maybe")).toBe(false);
  });

  it("integer: only integer-like strings", () => {
    expect(isPlausibleValue(intField, "42")).toBe(true);
    expect(isPlausibleValue(intField, "-10")).toBe(true);
    expect(isPlausibleValue(intField, "3.14")).toBe(false);
    expect(isPlausibleValue(intField, "abc")).toBe(false);
  });

  it("float: integer or decimal", () => {
    expect(isPlausibleValue(floatField, "3.14")).toBe(true);
    expect(isPlausibleValue(floatField, "42")).toBe(true);
    expect(isPlausibleValue(floatField, "-1.5")).toBe(true);
    expect(isPlausibleValue(floatField, "abc")).toBe(false);
  });

  it("date: valid ISO-like dates are plausible", () => {
    expect(isPlausibleValue(dateField, "2024-01-15")).toBe(true);
    expect(isPlausibleValue(dateField, "2024")).toBe(true); // starts with digit
    expect(isPlausibleValue(dateField, "not-a-date-xyz")).toBe(false);
  });

  it("datetime: valid date/datetime strings are plausible", () => {
    expect(isPlausibleValue(datetimeField, "2024-01-15T10:00:00")).toBe(true);
    expect(isPlausibleValue(datetimeField, "banana")).toBe(false);
  });

  it("set: always false (must select from list)", () => {
    expect(isPlausibleValue(setField, "New")).toBe(false);
    expect(isPlausibleValue(setField, "anything")).toBe(false);
  });
});

// ── isValidValue ─────────────────────────────────────────────────────────────

describe("isValidValue", () => {
  it("returns false for empty string", () => {
    expect(isValidValue(stringField, "")).toBe(false);
    expect(isValidValue(intField, "")).toBe(false);
  });

  it("string: any non-empty value is valid", () => {
    expect(isValidValue(stringField, "hello")).toBe(true);
  });

  it("custom: any non-empty value is valid", () => {
    expect(isValidValue(customField, "anything")).toBe(true);
  });

  it("boolean: only true/false/yes/no/1/0", () => {
    for (const v of ["true", "false", "yes", "no", "1", "0"]) {
      expect(isValidValue(boolField, v)).toBe(true);
    }
    expect(isValidValue(boolField, "maybe")).toBe(false);
  });

  it("integer: only whole number strings (no decimals)", () => {
    expect(isValidValue(intField, "42")).toBe(true);
    expect(isValidValue(intField, "-10")).toBe(true);
    expect(isValidValue(intField, "3.14")).toBe(false);
    expect(isValidValue(intField, "abc")).toBe(false);
  });

  it("float: integer or exact decimal (no trailing dot)", () => {
    expect(isValidValue(floatField, "3.14")).toBe(true);
    expect(isValidValue(floatField, "42")).toBe(true);
    expect(isValidValue(floatField, "3.")).toBe(false); // trailing dot, no digits after
    expect(isValidValue(floatField, "abc")).toBe(false);
  });

  it("date: must be a parseable date", () => {
    expect(isValidValue(dateField, "2024-01-15")).toBe(true);
    expect(isValidValue(dateField, "not-a-date")).toBe(false);
  });

  it("datetime: must be a parseable datetime", () => {
    expect(isValidValue(datetimeField, "2024-01-15T10:00:00Z")).toBe(true);
    expect(isValidValue(datetimeField, "garbage")).toBe(false);
  });

  it("set: always true (validity checked externally)", () => {
    expect(isValidValue(setField, "New")).toBe(true);
    expect(isValidValue(setField, "NotInList")).toBe(true);
  });
});
