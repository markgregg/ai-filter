import type { AnyOperator, FieldDefinition, FieldType } from "./types";

const STRING_OPERATORS: AnyOperator[] = ["=", "!", "*", "!*", "<*", ">*"];
const COMPARE_OPERATORS: AnyOperator[] = ["=", "!", ">", "<", ">=", "<="];
const BOOLEAN_OPERATORS: AnyOperator[] = ["=", "!"];
const SET_OPERATORS: AnyOperator[] = ["=", "!", "in"];

export const OPERATOR_ORDER = [">=", "<=", "!*", "<*", ">*", "=", "!", ">", "<", "*", "in"];

export function operatorsForField(field: FieldDefinition): AnyOperator[] {
  if (field.type === "custom" && field.operators?.length) {
    return field.operators;
  }

  return operatorsForType(field.type);
}

export function operatorsForType(type: FieldType): AnyOperator[] {
  switch (type) {
    case "string":
      return STRING_OPERATORS;
    case "integer":
    case "float":
    case "date":
    case "datetime":
      return COMPARE_OPERATORS;
    case "boolean":
      return BOOLEAN_OPERATORS;
    case "set":
      return SET_OPERATORS;
    case "custom":
      return ["="];
  }
}

export function defaultOperatorForType(type: FieldType): AnyOperator {
  return type === "string" ? "*" : "=";
}

export function findLeadingOperator(input: string): { op?: AnyOperator; rest: string } {
  const trimmed = input.trimStart();
  for (const op of OPERATOR_ORDER) {
    if (trimmed.startsWith(op)) {
      return { op, rest: trimmed.slice(op.length).trim() };
    }
  }

  return { rest: input.trim() };
}

/**
 * Returns true when `value` is a plausible (possibly partial) input for `field`.
 * Used to decide whether to show a value-candidate in the match dropdown.
 */
export function isPlausibleValue(field: FieldDefinition, value: string): boolean {
  if (!value) return false;
  switch (field.type) {
    case "string":
    case "custom":
      return true;
    case "boolean":
      return /^(true|false|yes|no|1|0)$/i.test(value);
    case "integer":
      return /^-?\d+$/.test(value);
    case "float":
      return /^-?\d+(\.\d*)?$/.test(value);
    case "date":
      return !Number.isNaN(Date.parse(value)) || /^\d/.test(value);
    case "datetime":
      return !Number.isNaN(Date.parse(value)) || /^\d/.test(value);
    case "set":
      return false; // set fields require a value from the hint/set-values list
  }
}

/**
 * Returns true when `value` is a fully valid (committable) value for `field`.
 * Used to validate pill editor inputs before committing.
 */
export function isValidValue(field: FieldDefinition, value: string): boolean {
  if (!value) return false;
  switch (field.type) {
    case "string":
    case "custom":
      return true;
    case "boolean":
      return /^(true|false|yes|no|1|0)$/i.test(value);
    case "integer":
      return /^-?\d+$/.test(value);
    case "float":
      return /^-?\d+(\.\d+)?$/.test(value);
    case "date":
      return !Number.isNaN(Date.parse(value));
    case "datetime":
      return !Number.isNaN(Date.parse(value));
    case "set":
      return true; // set validity is checked against the options list separately
  }
}
