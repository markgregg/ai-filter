import { preprocess, resolveDateToken, resolveOp } from "./synonyms";

describe("synonyms preprocess", () => {
  it("replaces operator and date phrases with tokens", () => {
    const input = "status not one of new,closed and created this week";
    const out = preprocess(input);
    expect(out).toContain("__notoneof__");
    expect(out).toContain("__date_this_week__");
  });

  it("handles dynamic relative date phrases", () => {
    expect(preprocess("in 5 days")).toBe("__date_in_5d__");
    expect(preprocess("3 weeks ago")).toBe("__date_3w_ago__");
    expect(preprocess("in 2 months")).toBe("__date_in_2mo__");
    expect(preprocess("4 years ago")).toBe("__date_4y_ago__");
  });

  it("trims output", () => {
    expect(preprocess("  starts with abc  ")).toBe("__startswith__  abc");
  });
});

describe("synonyms resolveOp", () => {
  it("resolves symbolic and token operators", () => {
    expect(resolveOp(">=")).toBe(">=");
    expect(resolveOp("__contains__")).toBe("*");
    expect(resolveOp("__notoneof__")).toBe("!");
  });

  it("resolves english aliases case-insensitively", () => {
    expect(resolveOp("Contains")).toBe("*");
    expect(resolveOp("minimum")).toBe(">=");
    expect(resolveOp("AMONG")).toBe("in");
  });

  it("returns undefined for unknown operator", () => {
    expect(resolveOp("totally-unknown")).toBeUndefined();
  });
});

describe("synonyms resolveDateToken", () => {
  const now = new Date("2024-06-15T10:30:00.000Z");

  it("resolves named day tokens", () => {
    const today = resolveDateToken("today", now);
    const yesterday = resolveDateToken("yesterday", now);
    const tomorrow = resolveDateToken("tomorrow", now);

    expect(today).toEqual({ from: "2024-06-15", to: "2024-06-15" });
    expect(yesterday).toEqual({ from: "2024-06-14", to: "2024-06-14" });
    expect(tomorrow).toEqual({ from: "2024-06-16", to: "2024-06-16" });
  });

  it("resolves week/month/year range tokens", () => {
    expect(resolveDateToken("__date_this_week__", now)).toEqual({ from: "2024-06-10", to: "2024-06-16" });
    expect(resolveDateToken("__date_last_month__", now)).toEqual({ from: "2024-05-01", to: "2024-05-31" });
    expect(resolveDateToken("__date_next_year__", now)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });

  it("resolves dynamic relative date tokens", () => {
    expect(resolveDateToken("__date_10d_ago__", now)).toEqual({ from: "2024-06-05" });
    expect(resolveDateToken("__date_in_2w__", now)).toEqual({ from: "2024-06-29" });
    expect(resolveDateToken("__date_in_3mo__", now)).toEqual({ from: "2024-09-15" });
    expect(resolveDateToken("__date_1y_ago__", now)).toEqual({ from: "2023-06-15" });
  });

  it("handles now token and unknown token", () => {
    const resolved = resolveDateToken("now", now);
    expect(resolved?.from).toBe("2024-06-15T10:30:00.000Z");
    expect(resolveDateToken("__date_unknown__", now)).toBeUndefined();
  });
});
