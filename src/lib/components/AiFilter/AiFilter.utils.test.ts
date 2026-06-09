/**
 * AiFilter.utils.test.ts
 *
 * Comprehensive tests for matchesFromInput covering:
 *   - Field-prefix cases (field named typed, with/without operator, with/without value)
 *   - Set fields: setValues, hints, deduplication
 *   - String/numeric/boolean fields: value-candidate, hint matching
 *   - No-field-prefix cases: operator-only prefix, field name suggestions
 *   - maxInstances filtering
 *   - Result deduplication and sort order
 */

import { describe, expect, it } from "vitest";
import { matchesFromInput } from "./AiFilter.utils";
import type { FieldDefinition, Hint, MatchRankingConfig } from "../../types";

// ── Shared field fixtures ───────────────────────────────────────────────────

const FIELDS: FieldDefinition[] = [
  { name: "title", type: "string", precedence: 1, label: "Title" },
  { name: "count", type: "integer", precedence: 2 },
  { name: "price", type: "float", precedence: 3 },
  { name: "active", type: "boolean", precedence: 4 },
  { name: "status", type: "set", precedence: 5, setValues: ["New", "In Progress", "Done", "Blocked"] },
];

function matches(
  input: string,
  opts: {
    setValuesByField?: Record<string, string[]>;
    hintsByField?: Record<string, Hint[]>;
    pillCountByField?: Record<string, number>;
    fields?: FieldDefinition[];
    recentByField?: Record<string, unknown[]>;
    nlpEnabled?: boolean;
    matchRanking?: MatchRankingConfig | false;
  } = {}
) {
  return matchesFromInput({
    input,
    fields: opts.fields ?? FIELDS,
    nlpEnabled: opts.nlpEnabled,
    setValuesByField: opts.setValuesByField ?? {},
    hintsByField: opts.hintsByField ?? {},
    pillCountByField: opts.pillCountByField ?? {},
    recentByField: opts.recentByField ?? {},
    matchRanking: opts.matchRanking,
  });
}

// ── Empty / trivial input ────────────────────────────────────────────────────

describe("matchesFromInput — empty input", () => {
  it("returns empty array for empty string", () => {
    expect(matches("")).toEqual([]);
  });

  it("returns empty array for whitespace", () => {
    expect(matches("   ")).toEqual([]);
  });
});

// ── Field-name prefix matching ───────────────────────────────────────────────

describe("matchesFromInput — field prefix detection", () => {
  it("detects field prefix with trailing space and no value", () => {
    // "title " — has trailing space but no value → suppress
    const result = matches("title ");
    expect(result).toEqual([]);
  });

  it("detects field prefix and returns value-candidate for string field", () => {
    const result = matches("title bug");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe("value-candidate");
    expect(result[0].field.name).toBe("title");
    expect(result[0].text).toBe("bug");
  });

  it("returns value-candidate with operator when operator is typed", () => {
    const result = matches("title = hello");
    expect(result[0].type).toBe("value-candidate");
    expect(result[0].operator).toBe("=");
    expect(result[0].text).toBe("hello");
  });

  it("suppresses when operator present but no value", () => {
    const result = matches("title = ");
    expect(result).toEqual([]);
  });

  it("suppresses when operator is invalid for field", () => {
    // '>' is not valid for string field
    const result = matches("title > test");
    expect(result).toEqual([]);
  });
});

describe("matchesFromInput — unprefixed text behavior", () => {
  it("returns text value-candidates when NLP is disabled", () => {
    const result = matches("asdhsjkahdjk");
    expect(result.some((r) => r.type === "value-candidate" && r.field.type === "string")).toBe(true);
  });

  it("suppresses text value-candidates when NLP is enabled", () => {
    const result = matches("asdhsjkahdjk", { nlpEnabled: true });
    expect(result.some((r) => r.type === "value-candidate" && r.field.type === "string")).toBe(false);
  });
});

// ── Integer / float value-candidates ────────────────────────────────────────

describe("matchesFromInput — integer field value-candidates", () => {
  it("returns value-candidate for plausible integer", () => {
    const result = matches("count 42");
    expect(result[0].type).toBe("value-candidate");
    expect(result[0].text).toBe("42");
  });

  it("returns value-candidate with > operator", () => {
    const result = matches("count > 10");
    expect(result[0].operator).toBe(">");
    expect(result[0].text).toBe("10");
  });

  it("returns no match for non-integer value in integer field", () => {
    const result = matches("count abc");
    expect(result.length).toBe(0);
  });
});

// ── Boolean field ────────────────────────────────────────────────────────────

describe("matchesFromInput — boolean field", () => {
  it("returns value-candidate for 'true'", () => {
    const result = matches("active true");
    expect(result[0].type).toBe("value-candidate");
    expect(result[0].text).toBe("true");
  });

  it("returns no match for non-boolean value", () => {
    const result = matches("active maybe");
    expect(result.length).toBe(0);
  });
});

// ── Set field ───────────────────────────────────────────────────────────────

describe("matchesFromInput — set field with setValues", () => {
  const setValues = { status: ["New", "In Progress", "Done", "Blocked"] };

  it("returns set-value matches for partial input", () => {
    const result = matches("status new", { setValuesByField: setValues });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.type === "set-value")).toBe(true);
    expect(result.some((r) => r.text === "New")).toBe(true);
  });

  it("returns set-value matches case-insensitively", () => {
    const result = matches("status IN PROGRESS", { setValuesByField: setValues });
    expect(result.some((r) => r.text === "In Progress")).toBe(true);
  });

  it("returns all set-values that match", () => {
    const result = matches("status d", { setValuesByField: setValues });
    const texts = result.map((r) => r.text);
    // "Done" and "Blocked" both contain 'd'
    expect(texts).toContain("Done");
    expect(texts).toContain("Blocked");
  });

  it("returns empty when no set-value matches", () => {
    const result = matches("status zzz", { setValuesByField: setValues });
    expect(result).toEqual([]);
  });

  it("respects lookupMinChars for prefixed set fields", () => {
    const fields: FieldDefinition[] = [
      { name: "status", type: "set", precedence: 1, lookupMinChars: 3 },
    ];

    expect(matches("status ne", { fields, setValuesByField: { status: ["New", "Done"] } })).toEqual([]);
    expect(matches("status new", { fields, setValuesByField: { status: ["New", "Done"] } })[0]?.type).toBe("set-value");
  });
});

// ── Hints matching ───────────────────────────────────────────────────────────

describe("matchesFromInput — hint matching", () => {
  const hints: Hint[] = [
    { kind: "single", text: "Last week", operator: ">=", value: "2024-01-01" },
    { kind: "single", text: "This month", operator: ">=", value: "2024-02-01" },
  ];

  it("returns hint matches for partial hint text", () => {
    const result = matches("due week", { hintsByField: { due: hints }, fields: [
      ...FIELDS,
      { name: "due", type: "date", precedence: 6 },
    ]});
    expect(result.some((r) => r.type === "hint" && r.text === "Last week")).toBe(true);
  });

  it("returns non-prefixed hint matches for non-set fields", () => {
    const result = matches("week", {
      hintsByField: { due: hints },
      fields: [
        ...FIELDS,
        { name: "due", type: "date", precedence: 6 },
      ],
    });
    expect(result.some((r) => r.type === "hint" && r.field.name === "due")).toBe(true);
  });

  it("hint result includes hint payload", () => {
    const result = matches("due last", { hintsByField: { due: hints }, fields: [
      ...FIELDS,
      { name: "due", type: "date", precedence: 6 },
    ]});
    const hintMatch = result.find((r) => r.type === "hint");
    expect(hintMatch?.hint).toBeDefined();
  });

  it("set field with hints returns hints instead of set-values", () => {
    const setHints: Hint[] = [
      { kind: "single", text: "Open", operator: "=", value: "New" },
    ];
    const result = matches("status open", {
      setValuesByField: { status: ["New", "Done"] },
      hintsByField: { status: setHints },
    });
    expect(result.every((r) => r.type === "hint")).toBe(true);
  });

  it("matches set-field hints without a field prefix", () => {
    const result = matches("open", {
      fields: [
        ...FIELDS,
        { name: "state", type: "set", precedence: 6 },
      ],
      hintsByField: {
        state: [{ kind: "single", text: "Open", operator: "=", value: "Open" }],
      },
    });
    expect(result.some((r) => r.type === "hint" && r.field.name === "state")).toBe(true);
  });

  it("falls back to value-candidate when hints exist but none match", () => {
    const result = matches("title bug", {
      hintsByField: {
        title: [{ kind: "single", text: "Last week", operator: "=", value: "last week" }],
      },
    });
    expect(result[0]?.type).toBe("value-candidate");
    expect(result[0]?.text).toBe("bug");
  });
});

// ── No field prefix — field-name suggestions ─────────────────────────────────

describe("matchesFromInput — no field prefix, field name suggestions", () => {
  it("suggests field by name partial match", () => {
    const result = matches("tit");
    expect(result.some((r) => r.type === "field" && r.field.name === "title")).toBe(true);
  });

  it("suggests field by label partial match", () => {
    // "title" has label "Title"
    const result = matches("itle");
    expect(result.some((r) => r.type === "field" && r.field.name === "title")).toBe(true);
  });

  it("suggests multiple fields when needle matches multiple", () => {
    const result = matches("c");
    const fieldNames = result.filter((r) => r.type === "field").map((r) => r.field.name);
    // "count" matches "c", "price" has 'c' in it
    expect(fieldNames.length).toBeGreaterThan(0);
  });

  it("suggests set-values without field prefix when needle matches set value", () => {
    const result = matches("new", { setValuesByField: { status: ["New", "Done"] } });
    expect(result.some((r) => r.type === "set-value" && r.text === "New")).toBe(true);
  });

  it("orders set fields ahead of non-set fields when precedence ties", () => {
    const fields: FieldDefinition[] = [
      { name: "plain", label: "Alpha", type: "string", precedence: 1 },
      { name: "state", label: "Alpha", type: "set", precedence: 1, setValues: ["Alpha"] },
    ];
    const result = matches("alpha", { fields, setValuesByField: { state: ["Alpha"] } });
    expect(result[0]?.field.name).toBe("state");
  });

  it("prioritizes favorite fields when favorite counts are provided", () => {
    const fields: FieldDefinition[] = [
      { name: "alpha", type: "string", precedence: 10 },
      { name: "beta", type: "string", precedence: 1 },
    ];

    const result = matchesFromInput({
      input: "a",
      fields,
      setValuesByField: {},
      hintsByField: {},
      pillCountByField: {},
      favoriteFieldCounts: { alpha: 5, beta: 0 },
    });

    const fieldMatches = result.filter((r) => r.type === "field");
    expect(fieldMatches[0]?.field.name).toBe("alpha");
  });
});

// ── Leading operator without field prefix ────────────────────────────────────

describe("matchesFromInput — leading operator, no field prefix", () => {
  it("suppresses when only operator typed (no value)", () => {
    const result = matches("= ");
    expect(result).toEqual([]);
  });

  it("returns value-candidates for matching fields when op+value typed", () => {
    const result = matches("= 42");
    // count and price support = and 42 is plausible for both
    expect(result.some((r) => r.field.name === "count")).toBe(true);
    expect(result.some((r) => r.field.name === "price")).toBe(true);
  });

  it("skips fields that don't support the leading operator", () => {
    // > is not valid for string or boolean
    const result = matches("> 10");
    const fieldNames = result.map((r) => r.field.name);
    expect(fieldNames).not.toContain("title");
    expect(fieldNames).not.toContain("active");
  });

  it("does not include field-name suggestions when operator is present", () => {
    const result = matches("> 5");
    expect(result.every((r) => r.type !== "field")).toBe(true);
  });
});

// ── maxInstances filtering ───────────────────────────────────────────────────

describe("matchesFromInput — maxInstances filtering", () => {
  const limitedFields: FieldDefinition[] = [
    { name: "tag", type: "string", precedence: 1, maxInstances: 2 },
    { name: "other", type: "string", precedence: 2 },
  ];

  it("shows field when count is below maxInstances", () => {
    const result = matches("tag", {
      fields: limitedFields,
      pillCountByField: { tag: 1 },
    });
    expect(result.some((r) => r.field.name === "tag")).toBe(true);
  });

  it("hides field when count equals maxInstances", () => {
    const result = matches("tag", {
      fields: limitedFields,
      pillCountByField: { tag: 2 },
    });
    expect(result.every((r) => r.field.name !== "tag")).toBe(true);
  });

  it("hides field when count exceeds maxInstances", () => {
    const result = matches("tag", {
      fields: limitedFields,
      pillCountByField: { tag: 5 },
    });
    expect(result.every((r) => r.field.name !== "tag")).toBe(true);
  });
});

// ── Deduplication ────────────────────────────────────────────────────────────

describe("matchesFromInput — deduplication", () => {
  it("deduplicates identical value-candidates", () => {
    const result = matches("= 42");
    const countMatches = result.filter((r) => r.field.name === "count" && r.type === "value-candidate");
    expect(countMatches.length).toBeLessThanOrEqual(1);
  });
});

describe("matchesFromInput — behavioral ranking", () => {
  it("can prioritize exact/recent matches when matchRanking is enabled", () => {
    const fields: FieldDefinition[] = [
      { name: "title", type: "string", precedence: 1, label: "Title" },
      { name: "status", type: "set", precedence: 50, setValues: ["Done", "Blocked"] },
    ];

    const baseline = matches("done", {
      fields,
      setValuesByField: { status: ["Done", "Blocked"] },
    });
    expect(baseline[0]?.field.name).toBe("status");

    const ranked = matches("done", {
      fields,
      setValuesByField: { status: ["Done", "Blocked"] },
      recentByField: { title: ["done", "something else"] },
      matchRanking: { enabled: true, precedenceWeight: 0, usageWeight: 30, recencyWeight: 20, exactnessWeight: 20 },
    });

    expect(ranked[0]?.field.name).toBe("title");
    expect(ranked[0]?.type).toBe("value-candidate");
  });

  it("scores startsWith over contains for non-field matches", () => {
    const fields: FieldDefinition[] = [
      { name: "status", type: "set", precedence: 1, setValues: ["Done", "Undone"] },
    ];

    const ranked = matches("do", {
      fields,
      setValuesByField: { status: ["Done", "Undone"] },
      matchRanking: { enabled: true, precedenceWeight: 0, usageWeight: 0, recencyWeight: 0, exactnessWeight: 50 },
    });

    expect(ranked[0]?.text).toBe("Done");
  });

  it("handles operator-prefixed searches where exactness falls back to minimal score", () => {
    const ranked = matches("= 42", {
      matchRanking: { enabled: true, precedenceWeight: 0, usageWeight: 0, recencyWeight: 0, exactnessWeight: 50 },
    });

    expect(ranked.some((r) => r.type === "value-candidate" && r.text === "42")).toBe(true);
  });

  it("uses text tie-break when ranking scores are equal", () => {
    const fields: FieldDefinition[] = [
      { name: "ab", label: "ab", type: "string", precedence: 1 },
      { name: "aa", label: "aa", type: "string", precedence: 1 },
    ];

    const ranked = matches("a", {
      fields,
      matchRanking: { enabled: true, precedenceWeight: 0, usageWeight: 0, recencyWeight: 0, exactnessWeight: 0 },
    });

    const fieldMatches = ranked.filter((r) => r.type === "field").map((r) => r.text);
    expect(fieldMatches.slice(0, 2)).toEqual(["aa", "ab"]);
  });

  it("can score field-name includes matches when input is mid-word", () => {
    const fields: FieldDefinition[] = [
      { name: "title", type: "string", precedence: 1 },
    ];

    const ranked = matches("itl", {
      fields,
      matchRanking: { enabled: true, precedenceWeight: 0, usageWeight: 0, recencyWeight: 0, exactnessWeight: 50 },
    });

    expect(ranked.some((r) => r.type === "field" && r.field.name === "title")).toBe(true);
  });

});

describe("matchesFromInput — tree fields", () => {
  const treeField: FieldDefinition = {
    name: "city",
    type: "tree",
    precedence: 10,
    treeValues: [
      {
        value: "Europe",
        children: [
          { value: "Germany", children: [{ value: "Berlin" }, { value: "Munich" }] },
          { value: "Great Britain", children: [{ value: "London" }, { value: "Manchester" }] },
        ],
      },
    ],
  };

  it("returns parent aggregate hint when matching a parent node", () => {
    const result = matches("city europe", { fields: [treeField] });
    const hint = result.find((r) => r.type === "hint");
    expect(hint).toBeTruthy();
    expect(hint?.hint?.kind).toBe("list");
  });

  it("prefers leaf matches over parent matches when leaf text matches", () => {
    const result = matches("city ber", { fields: [treeField] });
    expect(result.some((r) => r.type === "set-value" && r.text === "Berlin")).toBe(true);
    expect(result.some((r) => r.type === "hint" && r.text === "Europe")).toBe(false);
  });
});

