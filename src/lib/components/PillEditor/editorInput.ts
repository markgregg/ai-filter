import type { FieldDefinition } from "../../types";

export type EditorInputType = "text" | "number" | "date" | "datetime-local";

export function getEditorInputType(field: FieldDefinition): EditorInputType {
  if (field.type === "datetime") return "datetime-local";
  if (field.type === "date") return "date";
  if (field.type === "integer" || field.type === "float") return "number";
  return "text";
}

export function getEditorInputStep(field: FieldDefinition): string | number | undefined {
  return field.type === "float" ? "any" : undefined;
}
