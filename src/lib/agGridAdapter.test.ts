import { describe, expect, it } from "vitest";
import { fieldsFromAgGrid, mergeWithAgGridFields } from "./agGridAdapter";
import type { AgGridApi, FieldDefinition } from "./types";

type Row = Record<string, unknown>;

function makeApi(args: {
  columns: Array<{
    field?: string;
    headerName?: string;
    cellDataType?: string;
    filter?: string | boolean;
    filterParams?: { values?: unknown };
  }>;
  rows?: Row[];
}): AgGridApi {
  return {
    getColumns: () =>
      args.columns.map((colDef) => ({
        getColDef: () => colDef,
      })),
    forEachNode: (callback) => {
      for (const row of args.rows ?? []) {
        callback({ data: row });
      }
    },
  };
}

describe("fieldsFromAgGrid", () => {
  it("builds fields from AG Grid columns and maps type + labels", async () => {
    const api = makeApi({
      columns: [
        { field: "name", headerName: "Name", cellDataType: "text" },
        { field: "score", headerName: "Score", cellDataType: "number" },
        { field: "createdAt", headerName: "Created", cellDataType: "dateTime" },
      ],
      rows: [
        { name: "Ada", score: 10, createdAt: "2026-01-01T10:00:00Z" },
        { name: "Bob", score: 20, createdAt: "2026-01-02T10:00:00Z" },
      ],
    });

    const fields = fieldsFromAgGrid(api);

    expect(fields).toHaveLength(3);
    expect(fields[0]).toMatchObject({ name: "name", label: "Name", type: "string" });
    expect(fields[1]).toMatchObject({ name: "score", label: "Score", type: "float" });
    expect(fields[2]).toMatchObject({ name: "createdAt", label: "Created", type: "datetime" });

    const hints = await (typeof fields[0].hints === "function" ? fields[0].hints() : []);
    expect(hints).toMatchObject([
      { kind: "single", text: "Ada", value: "Ada", operator: "=" },
      { kind: "single", text: "Bob", value: "Bob", operator: "=" },
    ]);
  });

  it("uses set type when agSetColumnFilter is configured", async () => {
    const api = makeApi({
      columns: [
        {
          field: "status",
          headerName: "Status",
          cellDataType: "text",
          filter: "agSetColumnFilter",
          filterParams: { values: ["New", "Done"] },
        },
      ],
      rows: [{ status: "Ignored" }],
    });

    const [statusField] = fieldsFromAgGrid(api);
    expect(statusField).toMatchObject({ name: "status", type: "set" });

    if (statusField.type !== "set") {
      throw new Error("Expected set field");
    }

    expect(statusField.setValues).toEqual(["New", "Done"]);

    const hints = await (typeof statusField.hints === "function" ? statusField.hints() : []);
    expect(hints).toMatchObject([
      { kind: "single", text: "New", value: "New", operator: "=" },
      { kind: "single", text: "Done", value: "Done", operator: "=" },
    ]);
  });

  it("falls back to row values for set filter values when static values are absent", async () => {
    const api = makeApi({
      columns: [{ field: "team", filter: "agSetColumnFilter" }],
      rows: [{ team: "A" }, { team: "B" }, { team: "A" }],
    });

    const [teamField] = fieldsFromAgGrid(api);
    if (teamField.type !== "set" || typeof teamField.setValues !== "function") {
      throw new Error("Expected dynamic set field");
    }

    await expect(teamField.setValues("a")).resolves.toEqual(["A"]);
    await expect(teamField.setValues("")).resolves.toEqual(["A", "B"]);
  });
});

describe("mergeWithAgGridFields", () => {
  it("overrides AG Grid fields with user fields by name and keeps extras", () => {
    const agFields: FieldDefinition[] = [
      { name: "status", label: "Status", type: "set", precedence: 2, setValues: ["New"] },
      { name: "age", label: "Age", type: "float", precedence: 1 },
    ];

    const userFields: FieldDefinition[] = [
      { name: "status", label: "Ticket Status", type: "set", precedence: 99, setValues: ["Open", "Closed"] },
      { name: "priority", label: "Priority", type: "integer", precedence: 10 },
    ];

    const merged = mergeWithAgGridFields(agFields, userFields);

    expect(merged).toHaveLength(3);
    expect(merged[0]).toMatchObject({ name: "status", label: "Ticket Status", precedence: 99 });
    expect(merged[1]).toMatchObject({ name: "age" });
    expect(merged[2]).toMatchObject({ name: "priority" });
  });
});
