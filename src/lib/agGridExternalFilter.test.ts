import { describe, expect, it, vi } from "vitest";
import { buildAgGridExternalFilter, syncAgGridExternalFilter } from "./agGridExternalFilter";
import type { FieldDefinition, FilterPill } from "./types";

const fields: FieldDefinition[] = [
  { name: "title", type: "string", precedence: 10 },
  { name: "count", type: "integer", precedence: 9 },
  { name: "price", type: "float", precedence: 8 },
  { name: "active", type: "boolean", precedence: 7 },
  { name: "due", type: "date", precedence: 6 },
  { name: "created", type: "datetime", precedence: 5 },
  { name: "status", type: "set", precedence: 4, setValues: ["New", "Done"] },
  { name: "tag", type: "custom", precedence: 3, translate: (v) => v, operators: ["=", "*", "!*"] },
];

function value(id: string, fieldName: string, operator: string, val: unknown): FilterPill {
  return {
    id,
    kind: "value",
    fieldName,
    operator: operator as any,
    value: val,
  };
}

function list(id: string, fieldName: string, operator: string, values: unknown[]): FilterPill {
  return {
    id,
    kind: "list",
    fieldName,
    operator: operator as any,
    values,
  };
}

function range(id: string, fieldName: string, from: unknown, to: unknown): FilterPill {
  return {
    id,
    kind: "range",
    fieldName,
    from,
    to,
  };
}

describe("buildAgGridExternalFilter", () => {
  it("matches string operators", () => {
    const contains = buildAgGridExternalFilter([value("1", "title", "*", "bug")], fields);
    expect(contains.doesExternalFilterPass({ data: { title: "big bug found" } })).toBe(true);
    expect(contains.doesExternalFilterPass({ data: { title: "feature" } })).toBe(false);

    const starts = buildAgGridExternalFilter([value("2", "title", "<*", "foo")], fields);
    expect(starts.doesExternalFilterPass({ data: { title: "Foobar" } })).toBe(true);
    expect(starts.doesExternalFilterPass({ data: { title: "barfoo" } })).toBe(false);

    const notContains = buildAgGridExternalFilter([value("3", "title", "!*", "foo")], fields);
    expect(notContains.doesExternalFilterPass({ data: { title: "bar" } })).toBe(true);
    expect(notContains.doesExternalFilterPass({ data: { title: "food" } })).toBe(false);
  });

  it("matches numeric, boolean, date, and datetime field types", () => {
    const pills: FilterPill[] = [
      value("1", "count", ">=", 10),
      { id: "a", kind: "and" },
      value("2", "price", "<", 50.5),
      { id: "b", kind: "and" },
      value("3", "active", "=", true),
      { id: "c", kind: "and" },
      value("4", "due", ">=", "2026-01-10T00:00:00.000Z"),
      { id: "d", kind: "and" },
      value("5", "created", "<", "2026-03-01T00:00:00.000Z"),
    ];

    const filter = buildAgGridExternalFilter(pills, fields);

    expect(
      filter.doesExternalFilterPass({
        data: {
          count: 11,
          price: 49.5,
          active: true,
          due: "2026-02-01",
          created: "2026-02-15T09:00:00.000Z",
        },
      }),
    ).toBe(true);

    expect(
      filter.doesExternalFilterPass({
        data: {
          count: 9,
          price: 49.5,
          active: true,
          due: "2026-02-01",
          created: "2026-02-15T09:00:00.000Z",
        },
      }),
    ).toBe(false);
  });

  it("matches custom field type using string-like operators", () => {
    const contains = buildAgGridExternalFilter([value("1", "tag", "*", "alpha")], fields);
    expect(contains.doesExternalFilterPass({ data: { tag: "alpha-beta" } })).toBe(true);
    expect(contains.doesExternalFilterPass({ data: { tag: "gamma" } })).toBe(false);

    const notContains = buildAgGridExternalFilter([value("2", "tag", "!*", "beta")], fields);
    expect(notContains.doesExternalFilterPass({ data: { tag: "alpha" } })).toBe(true);
    expect(notContains.doesExternalFilterPass({ data: { tag: "beta" } })).toBe(false);
  });

  it("matches set list and range pills", () => {
    const setList = buildAgGridExternalFilter([list("1", "status", "in", ["New", "Done"])], fields);
    expect(setList.doesExternalFilterPass({ data: { status: "New" } })).toBe(true);
    expect(setList.doesExternalFilterPass({ data: { status: "Blocked" } })).toBe(false);

    const setNot = buildAgGridExternalFilter([list("2", "status", "!", ["Done"])], fields);
    expect(setNot.doesExternalFilterPass({ data: { status: "New" } })).toBe(true);
    expect(setNot.doesExternalFilterPass({ data: { status: "Done" } })).toBe(false);

    const ranged = buildAgGridExternalFilter([range("3", "count", 5, 10)], fields);
    expect(ranged.doesExternalFilterPass({ data: { count: 8 } })).toBe(true);
    expect(ranged.doesExternalFilterPass({ data: { count: 12 } })).toBe(false);
  });

  it("supports brackets with and/or combinations", () => {
    const pills: FilterPill[] = [
      { id: "1", kind: "open-bracket" },
      value("2", "status", "=", "New"),
      { id: "3", kind: "or" },
      value("4", "status", "=", "Done"),
      { id: "5", kind: "close-bracket" },
      { id: "6", kind: "and" },
      value("7", "active", "=", true),
    ];

    const filter = buildAgGridExternalFilter(pills, fields);

    expect(filter.doesExternalFilterPass({ data: { status: "New", active: true } })).toBe(true);
    expect(filter.doesExternalFilterPass({ data: { status: "Done", active: true } })).toBe(true);
    expect(filter.doesExternalFilterPass({ data: { status: "Done", active: false } })).toBe(false);
    expect(filter.doesExternalFilterPass({ data: { status: "Blocked", active: true } })).toBe(false);
  });

  it("treats adjacent expressions as implicit AND", () => {
    const filter = buildAgGridExternalFilter(
      [value("1", "count", ">=", 5), value("2", "price", "<", 10)],
      fields,
    );

    expect(filter.doesExternalFilterPass({ data: { count: 6, price: 9 } })).toBe(true);
    expect(filter.doesExternalFilterPass({ data: { count: 6, price: 10 } })).toBe(false);
  });
});

describe("syncAgGridExternalFilter", () => {
  it("registers AG Grid external callbacks and filters row data", () => {
    const options = new Map<string, unknown>();
    const api = {
      setGridOption: vi.fn((key: string, value: unknown) => {
        options.set(key, value);
      }),
      onFilterChanged: vi.fn(),
    };

    const pills: FilterPill[] = [
      { id: "o1", kind: "open-bracket" },
      value("1", "count", ">", 10),
      { id: "and1", kind: "and" },
      value("2", "active", "=", true),
      { id: "c1", kind: "close-bracket" },
      { id: "or1", kind: "or" },
      list("3", "status", "in", ["Done"]),
    ];
    const onFilterChange = vi.fn();

    syncAgGridExternalFilter({ api, pills, fields, onFilterChange });

    expect(api.setGridOption).toHaveBeenCalledWith("isExternalFilterPresent", expect.any(Function));
    expect(api.setGridOption).toHaveBeenCalledWith("doesExternalFilterPass", expect.any(Function));
    expect(api.onFilterChanged).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledTimes(1);

    const isPresent = options.get("isExternalFilterPresent") as () => boolean;
    const doesPass = options.get("doesExternalFilterPass") as (row: { data: Record<string, unknown> }) => boolean;

    expect(isPresent()).toBe(true);
    expect(doesPass({ data: { count: 11, active: true, status: "New" } })).toBe(true);
    expect(doesPass({ data: { count: 2, active: false, status: "Done" } })).toBe(true);
    expect(doesPass({ data: { count: 11, active: false, status: "New" } })).toBe(false);
    expect(doesPass({ data: { count: 2, active: false, status: "Blocked" } })).toBe(false);
  });
});
