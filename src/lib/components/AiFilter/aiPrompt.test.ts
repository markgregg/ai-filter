/**
 * aiPrompt.test.ts
 *
 * Tests for buildFilterPrompt, parseFilterResponse, and aiToFilterPills.
 */

import { describe, expect, it, vi } from "vitest";
import { buildFilterPrompt, parseFilterResponse, aiToFilterPills } from "./aiPrompt";
import type { FieldDefinition, ValuePill } from "../../types";

const FIELDS: FieldDefinition[] = [
  { name: "title", type: "string", precedence: 1 },
  { name: "count", type: "integer", precedence: 2 },
  { name: "price", type: "float", precedence: 3 },
  { name: "status", type: "set", precedence: 4, setValues: ["New", "Done"] },
  { name: "active", type: "boolean", precedence: 5 },
];

// ── buildFilterPrompt ────────────────────────────────────────────────────────

describe("buildFilterPrompt", () => {
  it("includes the query text", () => {
    const prompt = buildFilterPrompt("find bugs", FIELDS, {});
    expect(prompt).toContain("find bugs");
  });

  it("includes each field name", () => {
    const prompt = buildFilterPrompt("test", FIELDS, {});
    for (const f of FIELDS) {
      expect(prompt).toContain(f.name);
    }
  });

  it("includes field types", () => {
    const prompt = buildFilterPrompt("test", FIELDS, {});
    expect(prompt).toContain("string");
    expect(prompt).toContain("integer");
    expect(prompt).toContain("float");
    expect(prompt).toContain("set");
    expect(prompt).toContain("boolean");
  });

  it("includes set values for set field from field definition", () => {
    const prompt = buildFilterPrompt("test", FIELDS, {});
    expect(prompt).toContain("New");
    expect(prompt).toContain("Done");
  });

  it("includes set values from setValuesByField when field has no static setValues", () => {
    const dynamicFields: FieldDefinition[] = [
      { name: "category", type: "set", precedence: 1 },
    ];
    const prompt = buildFilterPrompt("test", dynamicFields, { category: ["Alpha", "Beta"] });
    expect(prompt).toContain("Alpha");
    expect(prompt).toContain("Beta");
  });

  it("includes operator labels", () => {
    const prompt = buildFilterPrompt("test", FIELDS, {});
    expect(prompt).toContain("=");
    expect(prompt).toContain("contains");
  });
});

// ── parseFilterResponse ──────────────────────────────────────────────────────

describe("parseFilterResponse", () => {
  it("parses a simple value expression", () => {
    const pills = parseFilterResponse("title = hello", FIELDS);
    expect(pills.length).toBe(1);
    expect(pills[0].kind).toBe("value");
    expect((pills[0] as ValuePill).fieldName).toBe("title");
  });

  it("parses multiple lines", () => {
    const text = "title = hello\ncount > 5";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(2);
  });

  it("ignores blank lines", () => {
    const text = "\ntitle = hello\n\ncount > 5\n";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(2);
  });

  it("ignores code-fence lines", () => {
    const text = "```\ntitle = hello\n```";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(1);
  });

  it("ignores comment lines (#, //)", () => {
    const text = "# Filter expressions:\n// computed\ntitle = hello";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(1);
  });

  it("strips numbered list prefixes", () => {
    const text = "1. title = hello\n2. count > 5";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(2);
  });

  it("ignores lines with no space (unparseable)", () => {
    const text = "titlehello\ntitle = hello";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(1);
  });

  it("passes through AND as a logical connector", () => {
    const text = "title = hello\nAND\ncount > 5";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(3);
    expect(pills[1].kind).toBe("and");
  });

  it("passes through OR as a logical connector", () => {
    const text = "title = hello\nOR\ncount > 5";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(3);
    expect(pills[1].kind).toBe("or");
  });

  it("passes through ( and ) as bracket tokens", () => {
    const text = "(\ntitle = hello\nOR\ncount > 5\n)";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(5);
    expect(pills[0].kind).toBe("open-bracket");
    expect(pills[4].kind).toBe("close-bracket");
  });

  it("parses a bracketed group combined with an outer clause", () => {
    const text = "(\nstatus = New\nOR\nstatus = Done\n)\nAND\ntitle = hello";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(7);
    expect(pills[0].kind).toBe("open-bracket");
    expect(pills[1]).toMatchObject({ kind: "value", fieldName: "status", value: "New" });
    expect(pills[2].kind).toBe("or");
    expect(pills[3]).toMatchObject({ kind: "value", fieldName: "status", value: "Done" });
    expect(pills[4].kind).toBe("close-bracket");
    expect(pills[5].kind).toBe("and");
    expect(pills[6]).toMatchObject({ kind: "value", fieldName: "title" });
  });

  it("is case-insensitive for AND / OR / brackets", () => {
    const text = "(\ntitle = hello\nor\ncount > 5\n)";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills[0].kind).toBe("open-bracket");
    expect(pills[2].kind).toBe("or");
    expect(pills[4].kind).toBe("close-bracket");
  });

  it("prompt mentions AND OR and brackets in instructions", () => {
    const prompt = buildFilterPrompt("test", FIELDS, {});
    expect(prompt).toContain("AND");
    expect(prompt).toContain("OR");
    expect(prompt).toContain("(");
    expect(prompt).toContain(")");
  });

  it("returns empty for empty text", () => {
    expect(parseFilterResponse("", FIELDS)).toEqual([]);
  });

  it("handles set field in response", () => {
    const text = "status = New";
    const pills = parseFilterResponse(text, FIELDS);
    expect(pills.length).toBe(1);
    expect((pills[0] as ValuePill).fieldName).toBe("status");
    expect((pills[0] as ValuePill).value).toBe("New");
  });
});

// ── aiToFilterPills ──────────────────────────────────────────────────────────

describe("aiToFilterPills", () => {
  it("calls resolve with a prompt containing the query and returns parsed pills", async () => {
    const resolve = vi.fn().mockResolvedValue("title = hello");
    const pills = await aiToFilterPills("find hello", FIELDS, {}, resolve);
    expect(resolve).toHaveBeenCalledOnce();
    const prompt = resolve.mock.calls[0][0] as string;
    expect(prompt).toContain("find hello");
    expect(pills.length).toBe(1);
    expect((pills[0] as ValuePill).fieldName).toBe("title");
  });

  it("returns empty array when resolve returns empty string", async () => {
    const resolve = vi.fn().mockResolvedValue("");
    const pills = await aiToFilterPills("nothing", FIELDS, {}, resolve);
    expect(pills).toEqual([]);
  });

  it("passes setValuesByField into the prompt for dynamic set fields", async () => {
    // Only set fields WITHOUT static setValues will use setValuesByField
    const dynamicFields: FieldDefinition[] = [
      { name: "category", type: "set", precedence: 1 },
    ];
    const resolve = vi.fn().mockResolvedValue("");
    await aiToFilterPills("query", dynamicFields, { category: ["Alpha"] }, resolve);
    expect(resolve.mock.calls[0][0]).toContain("Alpha");
  });
});
