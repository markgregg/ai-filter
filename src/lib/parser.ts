import { defaultOperatorForType, findLeadingOperator, operatorsForField } from "./operators";
import type {
  AnyOperator,
  FieldDefinition,
  FilterPill,
  ListPill,
  LogicalToken,
  RangePill,
  ValuePill,
} from "./types";

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Format a Date object using a strftime-like pattern.
 * Supported tokens: yyyy, MM, dd, HH, mm, ss
 */
export function applyDateFormat(d: Date, format: string): string {
  const pad = (n: number, len = 2): string => String(n).padStart(len, "0");
  return format
    .replace("yyyy", pad(d.getFullYear(), 4))
    .replace("MM", pad(d.getMonth() + 1))
    .replace("dd", pad(d.getDate()))
    .replace("HH", pad(d.getHours()))
    .replace("mm", pad(d.getMinutes()))
    .replace("ss", pad(d.getSeconds()));
}

/**
 * Format a stored date value for display/editing.
 * `fieldType` determines the default format when `dateFormat` is not provided.
 */
export function formatDateValue(value: unknown, fieldType: "date" | "datetime", dateFormat?: string): string {
  const defaultFormat = fieldType === "datetime" ? "yyyy-MM-dd HH:mm:ss" : "yyyy-MM-dd";
  const fmt = dateFormat ?? defaultFormat;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return applyDateFormat(d, fmt);
}

export function parseLogicalToken(text: string): LogicalToken | undefined {
  const v = text.trim().toUpperCase();
  if (v === "AND") return "AND";
  if (v === "OR") return "OR";
  if (v === "(") return "(";
  if (v === ")") return ")";
  return undefined;
}

export function normalizePills(pills: FilterPill[]): FilterPill[] {
  // Pass 1: validate brackets, tracking which open-brackets are unmatched.
  let balance = 0;
  const unmatchedOpenIndices = new Set<number>();
  const openStack: number[] = [];

  const afterBrackets = pills.map((pill, i) => {
    if (pill.kind === "open-bracket") {
      openStack.push(i);
      balance += 1;
      return pill;
    }
    if (pill.kind === "close-bracket") {
      if (balance === 0) {
        return { ...pill, invalid: true };
      }
      openStack.pop();
      balance -= 1;
      return { ...pill, invalid: false };
    }
    return pill;
  });

  // Any open-brackets still on the stack are unmatched.
  for (const idx of openStack) {
    unmatchedOpenIndices.add(idx);
  }

  // Pass 2: mark unmatched open-brackets and adjacent logical operators.
  return afterBrackets.map((pill, i) => {
    if (pill.kind === "open-bracket") {
      return { ...pill, invalid: unmatchedOpenIndices.has(i) };
    }

    if (pill.kind === "and" || pill.kind === "or") {
      const prev = i > 0 ? afterBrackets[i - 1] : undefined;
      const next = i < afterBrackets.length - 1 ? afterBrackets[i + 1] : undefined;
      const prevIsLogical = prev?.kind === "and" || prev?.kind === "or";
      const nextIsLogical = next?.kind === "and" || next?.kind === "or";
      return { ...pill, invalid: prevIsLogical || nextIsLogical };
    }

    return pill;
  });
}

export function parsePrimitive(field: FieldDefinition, raw: string): unknown {
  const text = raw.trim();
  if (field.translate) {
    return field.translate(text);
  }

  switch (field.type) {
    case "integer": {
      const n = Number.parseInt(text, 10);
      return Number.isNaN(n) ? text : n;
    }
    case "float": {
      const f = Number.parseFloat(text);
      return Number.isNaN(f) ? text : f;
    }
    case "boolean":
      return /^true|1|yes$/i.test(text);
    case "date":
    case "datetime": {
      const d = new Date(text);
      return Number.isNaN(d.getTime()) ? text : d.toISOString();
    }
    default:
      return text;
  }
}

function parseRange(text: string): { from: string; to: string } | undefined {
  const match = text.match(/^(.+?)\s+to\s+(.+)$/i);
  if (!match) return undefined;
  return { from: match[1].trim(), to: match[2].trim() };
}

function splitFieldPrefix(input: string, fields: FieldDefinition[]): { field?: FieldDefinition; rest: string } {
  const trimmed = input.trim();
  const exact = fields.find((f) => trimmed.toLowerCase().startsWith(`${f.name.toLowerCase()} `));
  if (!exact) {
    return { rest: trimmed };
  }

  return {
    field: exact,
    rest: trimmed.slice(exact.name.length).trim(),
  };
}

export function parseInputToPill(args: {
  input: string;
  fields: FieldDefinition[];
  preferredField?: string;
  previousPill?: FilterPill;
}): FilterPill | undefined {
  const { input, fields, preferredField, previousPill } = args;
  const raw = input.trim();
  if (!raw) return undefined;

  const token = parseLogicalToken(raw);
  if (token === "AND") return { id: makeId(), kind: "and" };
  if (token === "OR") return { id: makeId(), kind: "or" };
  if (token === "(") return { id: makeId(), kind: "open-bracket" };
  if (token === ")") return { id: makeId(), kind: "close-bracket" };

  const prefField = preferredField
    ? fields.find((f) => f.name === preferredField)
    : undefined;

  const { field: prefixedField, rest: afterField } = splitFieldPrefix(raw, fields);
  const chosenField = prefixedField ?? prefField ?? fields[0];
  if (!chosenField) return undefined;

  const { op, rest } = findLeadingOperator(afterField);
  const range = parseRange(rest || afterField);

  if (range && ["integer", "float", "date", "custom"].includes(chosenField.type)) {
    if (!range.from.trim() || !range.to.trim()) {
      return undefined;
    }

    const rangePill: RangePill = {
      id: makeId(),
      kind: "range",
      fieldName: chosenField.name,
      from: parsePrimitive(chosenField, range.from),
      to: parsePrimitive(chosenField, range.to),
    };

    return rangePill;
  }

  const operator = (op ?? defaultOperatorForType(chosenField.type)) as AnyOperator;
  const allowedOps = operatorsForField(chosenField);
  const finalOp = allowedOps.includes(operator) ? operator : allowedOps[0];
  const valueText = (rest || afterField).trim();
  if (!valueText) {
    return undefined;
  }

  const parsedValue = parsePrimitive(chosenField, valueText);

  if (
    chosenField.type === "set" &&
    previousPill?.kind === "value" &&
    previousPill.fieldName === chosenField.name &&
    previousPill.operator === finalOp
  ) {
    if (String(previousPill.value) === String(parsedValue)) return undefined;
    const merged: ListPill = {
      id: makeId(),
      kind: "list",
      fieldName: chosenField.name,
      operator: finalOp,
      values: [previousPill.value, parsedValue],
    };
    return merged;
  }

  if (
    chosenField.type === "set" &&
    previousPill?.kind === "list" &&
    previousPill.fieldName === chosenField.name &&
    previousPill.operator === finalOp
  ) {
    if (previousPill.values.some((v) => String(v) === String(parsedValue))) return undefined;
    const merged: ListPill = {
      ...previousPill,
      values: [...previousPill.values, parsedValue],
    };
    return merged;
  }

  if (chosenField.type === "set" && valueText.includes(",")) {
    const values = valueText
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => parsePrimitive(chosenField, part));

    if (!values.length) {
      return undefined;
    }

    return {
      id: makeId(),
      kind: "list",
      fieldName: chosenField.name,
      operator: "in",
      values,
    };
  }

  const valuePill: ValuePill = {
    id: makeId(),
    kind: "value",
    fieldName: chosenField.name,
    operator: finalOp,
    value: parsedValue,
  };

  return valuePill;
}

export function pillLabel(pill: FilterPill, fields: FieldDefinition[]): string {
  if (pill.kind === "and") return "AND";
  if (pill.kind === "or") return "OR";
  if (pill.kind === "open-bracket") return "(";
  if (pill.kind === "close-bracket") return ")";

  const field = fields.find((f) => f.name === pill.fieldName);
  const fieldName = field?.label ?? pill.fieldName;

  if (pill.kind === "range") {
    return `${fieldName}: ${String(pill.from)} to ${String(pill.to)}`;
  }

  if (pill.kind === "list") {
    return `${fieldName} in (${pill.values.map((v) => String(v)).join(", ")})`;
  }

  const op = pill.operator;
  const isDefaultOp = op === defaultOperatorForType(field?.type ?? "string");
  if (isDefaultOp) {
    return `${fieldName}: ${String(pill.value)}`;
  }
  return `${fieldName} ${op} ${String(pill.value)}`;
}
