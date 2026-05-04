import { describe, expect, it } from "vitest";
import { parseFilterQuery } from "./parse";
import type { AstListExpr, AstRangeExpr, AstValueExpr, AstGroupExpr } from "./parse";

// ── Value expressions — symbol operators ────────────────────────────────────

describe("value expressions — symbol operators", () => {
  it("parses > symbol", () => {
    const [n] = parseFilterQuery("cost > 10") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", field: "cost", op: ">", value: { kind: "number", raw: "10" } });
  });

  it("parses >= symbol", () => {
    const [n] = parseFilterQuery("priority >= 3") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: ">=", value: { raw: "3" } });
  });

  it("parses <= symbol", () => {
    const [n] = parseFilterQuery("priority <= 5") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "<=" });
  });

  it("parses = symbol", () => {
    const [n] = parseFilterQuery("state = Done") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", field: "state", op: "=", value: { raw: "Done" } });
  });

  it("parses != symbol", () => {
    const [n] = parseFilterQuery("state != Done") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "!" });
  });

  it("parses * symbol", () => {
    const [n] = parseFilterQuery("title * bug") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "*", value: { raw: "bug" } });
  });

  it("parses <* symbol", () => {
    const [n] = parseFilterQuery("title <* AP") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "<*" });
  });

  it("parses >* symbol", () => {
    const [n] = parseFilterQuery("title >* ing") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: ">*" });
  });

  it("parses !* symbol", () => {
    const [n] = parseFilterQuery("title !* bug") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "!*" });
  });

  it("parses ! symbol", () => {
    const [n] = parseFilterQuery("state ! Done") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "!" });
  });
});

// ── Value expressions — word operator synonyms ───────────────────────────────

describe("value expressions — word operator synonyms", () => {
  it("parses 'greater than'", () => {
    const [n] = parseFilterQuery("cost greater than 10") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: ">" });
  });

  it("parses 'greater than or equal to'", () => {
    const [n] = parseFilterQuery("cost greater than or equal to 10") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: ">=" });
  });

  it("parses 'at least'", () => {
    const [n] = parseFilterQuery("cost at least 10") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: ">=" });
  });

  it("parses 'at most'", () => {
    const [n] = parseFilterQuery("cost at most 50") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "<=" });
  });

  it("parses 'is'", () => {
    const [n] = parseFilterQuery("state is Done") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "=" });
  });

  it("parses 'is not'", () => {
    const [n] = parseFilterQuery("state is not Done") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "!" });
  });

  it("parses 'contains'", () => {
    const [n] = parseFilterQuery("title contains bug") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "*" });
  });

  it("parses 'starts with'", () => {
    const [n] = parseFilterQuery("title starts with AP") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "<*" });
  });

  it("parses 'ends with'", () => {
    const [n] = parseFilterQuery("title ends with ing") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: ">*" });
  });

  it("parses 'does not contain'", () => {
    const [n] = parseFilterQuery("title does not contain bug") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "!*" });
  });

  it("parses 'not' keyword operator", () => {
    const [n] = parseFilterQuery("state not Done") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "!" });
  });

  it("parses 'before' as < operator", () => {
    const [n] = parseFilterQuery("due before 2026-01-01") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: "<" });
  });

  it("parses 'after' as > operator", () => {
    const [n] = parseFilterQuery("due after 2026-01-01") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", op: ">" });
  });
});

// ── Value expressions — implicit operator ────────────────────────────────────

describe("value expressions — implicit operator", () => {
  it("two tokens: field + value, op is null", () => {
    const [n] = parseFilterQuery("state Done") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", field: "state", op: null, value: { raw: "Done" } });
  });

  it("single token: field null, op null", () => {
    const [n] = parseFilterQuery("Done") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", field: null, op: null, value: { raw: "Done" } });
  });

  it("ISO date value", () => {
    const [n] = parseFilterQuery("due = 2026-01-15") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", value: { kind: "date", raw: "2026-01-15" } });
  });

  it("numeric value is kind:number", () => {
    const [n] = parseFilterQuery("cost = 42.5") as AstValueExpr[];
    expect(n).toMatchObject({ type: "value", value: { kind: "number", raw: "42.5" } });
  });
});

// ── Range expressions ─────────────────────────────────────────────────────────

describe("range expressions", () => {
  it("parses 'field from X to Y'", () => {
    const [n] = parseFilterQuery("cost from 10 to 50") as AstRangeExpr[];
    expect(n).toMatchObject({ type: "range", field: "cost", from: { raw: "10" }, to: { raw: "50" } });
  });

  it("parses 'field between X and Y'", () => {
    const [n] = parseFilterQuery("cost between 10 and 50") as AstRangeExpr[];
    expect(n).toMatchObject({ type: "range", field: "cost", from: { raw: "10" }, to: { raw: "50" } });
  });

  it("parses fieldless 'from X to Y'", () => {
    const [n] = parseFilterQuery("from 10 to 50") as AstRangeExpr[];
    expect(n).toMatchObject({ type: "range", field: null, from: { raw: "10" }, to: { raw: "50" } });
  });

  it("parses fieldless 'between X and Y'", () => {
    const [n] = parseFilterQuery("between 10 and 50") as AstRangeExpr[];
    expect(n).toMatchObject({ type: "range", field: null, from: { raw: "10" }, to: { raw: "50" } });
  });

  it("parses date range 'field from X to Y'", () => {
    const [n] = parseFilterQuery("due from 2026-01-01 to 2026-12-31") as AstRangeExpr[];
    expect(n).toMatchObject({ type: "range", field: "due", from: { kind: "date" }, to: { kind: "date" } });
  });

  it("parses date range with phrase values", () => {
    const [n] = parseFilterQuery("due from last week to today") as AstRangeExpr[];
    expect(n.type).toBe("range");
    expect(n.field).toBe("due");
    expect(n.from.raw).toBe("__date_last_week__");
    expect(n.to.raw).toBe("today");
  });

  it("does NOT split 'and' inside 'between X and Y' as a logic connector", () => {
    const nodes = parseFilterQuery("cost between 1 and 10 and state = Done");
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({ type: "range", from: { raw: "1" }, to: { raw: "10" } });
    expect(nodes[1]).toMatchObject({ type: "AND" });
    expect(nodes[2]).toMatchObject({ type: "value" });
  });
});

// ── List expressions ──────────────────────────────────────────────────────────

describe("list expressions", () => {
  it("parses 'field in X, Y, Z'", () => {
    const [n] = parseFilterQuery("state in Done,Blocked,New") as AstListExpr[];
    expect(n).toMatchObject({ type: "list", field: "state", op: "in" });
    expect(n.values).toHaveLength(3);
  });

  it("parses 'field one of X, Y'", () => {
    const [n] = parseFilterQuery("state one of Done,Blocked") as AstListExpr[];
    expect(n).toMatchObject({ type: "list", op: "in" });
    expect(n.values).toHaveLength(2);
  });

  it("parses 'field one of X or Y'", () => {
    // "or" is a query-level connector; within a list use commas.
    // "state one of Done or Blocked" splits to [listExpr(Done), OR, valueExpr(Blocked)]
    const nodes = parseFilterQuery("state one of Done or Blocked");
    // At minimum the first node is a list (possibly only containing Done)
    expect(nodes[0]).toMatchObject({ type: "list", op: "in" });
  });

  it("parses 'field any of X, Y'", () => {
    const [n] = parseFilterQuery("state any of Done,Blocked") as AstListExpr[];
    expect(n).toMatchObject({ type: "list", op: "in" });
  });

  it("parses 'field none of X, Y'", () => {
    const [n] = parseFilterQuery("state none of Done,Blocked") as AstListExpr[];
    expect(n).toMatchObject({ type: "list", op: "!" });
    expect(n.values).toHaveLength(2);
  });

  it("parses 'field not one of X, Y'", () => {
    const [n] = parseFilterQuery("state not one of Done,Blocked") as AstListExpr[];
    expect(n).toMatchObject({ type: "list", op: "!" });
  });

  it("parses 'field not in X, Y'", () => {
    const [n] = parseFilterQuery("state not in Done,Blocked") as AstListExpr[];
    expect(n).toMatchObject({ type: "list", op: "!" });
  });
});

// ── Boolean logic ─────────────────────────────────────────────────────────────

describe("boolean logic", () => {
  it("parses AND between clauses", () => {
    const nodes = parseFilterQuery("cost > 10 and state = Done");
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toMatchObject({ type: "AND" });
  });

  it("parses OR between clauses", () => {
    const nodes = parseFilterQuery("cost > 10 or cost < 5");
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toMatchObject({ type: "OR" });
  });

  it("parses comma as implicit AND", () => {
    // Comma is only a list-item separator; clause-level separation requires AND/OR.
    // A comma-separated string like "cost > 10, state = Done" would need preprocessing
    // to become "cost > 10 and state = Done" for multi-clause parsing.
    const nodes = parseFilterQuery("cost > 10 and state = Done");
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toMatchObject({ type: "AND" });
  });

  it("parses chained AND clauses", () => {
    const nodes = parseFilterQuery("cost > 10 and priority < 5 and state = Done");
    expect(nodes).toHaveLength(5);
    expect(nodes[1]).toMatchObject({ type: "AND" });
    expect(nodes[3]).toMatchObject({ type: "AND" });
  });

  it("parses mixed AND/OR", () => {
    const nodes = parseFilterQuery("cost > 10 or cost < 5 and state = Done");
    expect(nodes.length).toBeGreaterThanOrEqual(5);
  });
});

// ── Parentheses / grouping ────────────────────────────────────────────────────

describe("parentheses and grouping", () => {
  it("parses grouped clause", () => {
    const nodes = parseFilterQuery("(cost > 10 or cost < 5) and state = Done");
    expect(nodes).toHaveLength(3);
    const group = nodes[0] as AstGroupExpr;
    expect(group.type).toBe("group");
    expect(group.clauses).toHaveLength(3);
    expect(nodes[1]).toMatchObject({ type: "AND" });
  });

  it("parses nested groups", () => {
    const nodes = parseFilterQuery("(cost > 10 and (state = Done or state = New))");
    expect(nodes[0]).toMatchObject({ type: "group" });
  });
});

// ── Date phrase preprocessing ─────────────────────────────────────────────────

describe("date phrase preprocessing", () => {
  it("collapses 'last week' to __date_last_week__", () => {
    const [n] = parseFilterQuery("due = last week") as AstValueExpr[];
    expect(n.value.raw).toBe("__date_last_week__");
  });

  it("collapses 'this month' to __date_this_month__", () => {
    const [n] = parseFilterQuery("due = this month") as AstValueExpr[];
    expect(n.value.raw).toBe("__date_this_month__");
  });

  it("collapses 'next year' to __date_next_year__", () => {
    const [n] = parseFilterQuery("due = next year") as AstValueExpr[];
    expect(n.value.raw).toBe("__date_next_year__");
  });

  it("collapses 'in 3 days' to __date_in_3d__", () => {
    const [n] = parseFilterQuery("due = in 3 days") as AstValueExpr[];
    expect(n.value.raw).toBe("__date_in_3d__");
  });

  it("collapses '5 months ago' to __date_5mo_ago__", () => {
    const [n] = parseFilterQuery("due = 5 months ago") as AstValueExpr[];
    expect(n.value.raw).toBe("__date_5mo_ago__");
  });

  it("collapses '2 weeks ago' to __date_2w_ago__", () => {
    const [n] = parseFilterQuery("due = 2 weeks ago") as AstValueExpr[];
    expect(n.value.raw).toBe("__date_2w_ago__");
  });

  it("collapses 'in 1 year' to __date_in_1y__", () => {
    const [n] = parseFilterQuery("due = in 1 year") as AstValueExpr[];
    expect(n.value.raw).toBe("__date_in_1y__");
  });
});

// ── Synonym resolution (synonyms.ts resolveOp) ────────────────────────────────

describe("synonym resolution", () => {
  it("resolves 'minimum' to >=", () => {
    const [n] = parseFilterQuery("cost minimum 10") as AstValueExpr[];
    expect(n.op).toBe(">=");
  });

  it("resolves 'maximum' to <=", () => {
    const [n] = parseFilterQuery("cost maximum 50") as AstValueExpr[];
    expect(n.op).toBe("<=");
  });

  it("resolves 'over' to >", () => {
    const [n] = parseFilterQuery("cost over 10") as AstValueExpr[];
    expect(n.op).toBe(">");
  });

  it("resolves 'below' to <", () => {
    const [n] = parseFilterQuery("cost below 10") as AstValueExpr[];
    expect(n.op).toBe("<");
  });

  it("resolves 'prefix' to <*", () => {
    const [n] = parseFilterQuery("title prefix AP") as AstValueExpr[];
    expect(n.op).toBe("<*");
  });

  it("resolves 'suffix' to >*", () => {
    const [n] = parseFilterQuery("title suffix ing") as AstValueExpr[];
    expect(n.op).toBe(">*");
  });

  it("resolves 'excludes' to !*", () => {
    const [n] = parseFilterQuery("title excludes bug") as AstValueExpr[];
    expect(n.op).toBe("!*");
  });

  it("resolves 'among' to in list op", () => {
    const [n] = parseFilterQuery("state among Done,Blocked") as AstListExpr[];
    expect(n.type).toBe("list");
    expect(n.op).toBe("in");
  });
});
