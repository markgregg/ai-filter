import type {
  AgGridApi,
  AgGridCellDataType,
  AgGridColumn,
  AgGridColumnDefinition,
  FieldDefinition,
  FieldType,
  Hint,
} from "./types";

type GeneratedFieldType = Exclude<FieldType, "custom">;

function toColumnDefinition(column: AgGridColumn): AgGridColumnDefinition | undefined {
  if (typeof column.getColDef === "function") return column.getColDef();
  return column.colDef;
}

function mapCellDataType(type: AgGridCellDataType | undefined): GeneratedFieldType {
  switch (type) {
    case "number":
    case "bigint":
      return "float";
    case "boolean":
      return "boolean";
    case "date":
    case "dateString":
      return "date";
    case "dateTime":
    case "dateTimeString":
      return "datetime";
    default:
      return "string";
  }
}

function toTextList(values: unknown[]): string[] {
  const unique = new Set<string>();
  values.forEach((value) => {
    if (value == null) return;
    unique.add(String(value));
  });
  return Array.from(unique);
}

function valuesFromRows(api: AgGridApi, fieldName: string, lookupText?: string): string[] {
  if (typeof api.forEachNode !== "function") return [];
  const unique = new Set<string>();
  const needle = lookupText?.trim().toLowerCase();
  api.forEachNode((node) => {
    const value = node.data?.[fieldName];
    if (value == null) return;
    const text = String(value);
    if (needle && !text.toLowerCase().includes(needle)) return;
    unique.add(text);
  });
  return Array.from(unique);
}

function setValuesFromColDef(colDef: AgGridColumnDefinition): string[] | undefined {
  const rawValues = colDef.filterParams?.values;
  if (!Array.isArray(rawValues)) return undefined;
  return toTextList(rawValues);
}

function makeHints(values: string[]): Hint[] {
  return values.map((value) => ({
    kind: "single",
    text: value,
    operator: "=",
    value,
  }));
}

function mapFieldType(colDef: AgGridColumnDefinition): GeneratedFieldType {
  if (colDef.filter === "agSetColumnFilter") return "set";
  return mapCellDataType(colDef.cellDataType);
}

export function fieldsFromAgGrid(api: AgGridApi): FieldDefinition[] {
  const columns = api.getColumns?.() ?? api.getAllGridColumns?.() ?? [];
  const defs = columns
    .map((column) => toColumnDefinition(column))
    .filter((colDef): colDef is AgGridColumnDefinition => Boolean(colDef?.field));

  const total = defs.length;
  return defs.map((colDef, index) => {
    const name = String(colDef.field);
    const label = colDef.headerName || name;
    const type = mapFieldType(colDef);
    const precedence = total - index;

    if (type === "set") {
      const staticValues = setValuesFromColDef(colDef);
      const setValues = staticValues
        ? staticValues
        : async (lookupText: string): Promise<string[]> =>
            valuesFromRows(api, name, lookupText);

      return {
        name,
        label,
        type,
        precedence,
        setValues,
        hints: async (): Promise<Hint[]> =>
          makeHints(staticValues ?? valuesFromRows(api, name)),
      };
    }

    return {
      name,
      label,
      type,
      precedence,
      hints: async (): Promise<Hint[]> => makeHints(valuesFromRows(api, name)),
    };
  });
}

export function mergeWithAgGridFields(
  agGridFields: FieldDefinition[],
  userFields: FieldDefinition[] | undefined,
): FieldDefinition[] {
  if (!userFields?.length) return agGridFields;

  const byName = new Map(userFields.map((field) => [field.name, field]));
  const merged: FieldDefinition[] = agGridFields.map((field) => byName.get(field.name) ?? field);
  const agNames = new Set(agGridFields.map((field) => field.name));

  for (const field of userFields) {
    if (!agNames.has(field.name)) merged.push(field);
  }

  return merged;
}