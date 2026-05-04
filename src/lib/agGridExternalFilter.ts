import type {
  AgGridApi,
  AgGridExternalFilter,
  AgGridRowNode,
  AnyOperator,
  FieldDefinition,
  FieldType,
  FilterChangeEvent,
  FilterPill,
} from "./types";

type ExprToken = {
  kind: "expr";
  eval: (row: Record<string, unknown>) => boolean;
};

type OpToken = {
  kind: "and" | "or" | "open" | "close";
};

type Token = ExprToken | OpToken;

function isBinaryOp(token: Token): token is OpToken & { kind: "and" | "or" } {
  return token.kind === "and" || token.kind === "or";
}

function asRecord(row: AgGridRowNode | Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!row) return {};
  if ("data" in row && row.data && typeof row.data === "object") {
    return row.data as Record<string, unknown>;
  }
  return row as Record<string, unknown>;
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = normalizeString(value);
  if (text === "true" || text === "1" || text === "yes") return true;
  if (text === "false" || text === "0" || text === "no") return false;
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseTime(value: unknown): number | undefined {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : undefined;
  }
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : undefined;
}

function comparableFor(fieldType: FieldType, value: unknown): string | number | boolean | undefined {
  switch (fieldType) {
    case "integer":
    case "float":
      return parseNumber(value);
    case "boolean":
      return parseBoolean(value);
    case "date":
    case "datetime":
      return parseTime(value);
    case "set":
    case "string":
    case "custom":
      return normalizeString(value);
  }
}

function compareEq(field: FieldDefinition, left: unknown, right: unknown): boolean {
  const l = comparableFor(field.type, left);
  const r = comparableFor(field.type, right);
  return l !== undefined && r !== undefined && l === r;
}

function compareOrder(field: FieldDefinition, left: unknown, right: unknown): number | undefined {
  const l = comparableFor(field.type, left);
  const r = comparableFor(field.type, right);
  if (l === undefined || r === undefined) return undefined;
  if (typeof l === "boolean" || typeof r === "boolean") return undefined;
  if (l === r) return 0;
  return l > r ? 1 : -1;
}

function evalValue(field: FieldDefinition, operator: AnyOperator, rowValue: unknown, pillValue: unknown): boolean {
  if (field.type === "string" || field.type === "custom") {
    const left = normalizeString(rowValue);
    const right = normalizeString(pillValue);
    if (operator === "=") return left === right;
    if (operator === "!") return left !== right;
    if (operator === "*") return left.includes(right);
    if (operator === "!*") return !left.includes(right);
    if (operator === "<*") return left.startsWith(right);
    if (operator === ">*") return left.endsWith(right);
  }

  if (field.type === "set") {
    if (operator === "in") return compareEq(field, rowValue, pillValue);
    if (operator === "=") return compareEq(field, rowValue, pillValue);
    if (operator === "!") return !compareEq(field, rowValue, pillValue);
  }

  if (operator === "=") return compareEq(field, rowValue, pillValue);
  if (operator === "!") return !compareEq(field, rowValue, pillValue);

  const cmp = compareOrder(field, rowValue, pillValue);
  if (cmp === undefined) return false;
  if (operator === ">") return cmp > 0;
  if (operator === "<") return cmp < 0;
  if (operator === ">=") return cmp >= 0;
  if (operator === "<=") return cmp <= 0;

  return false;
}

function evalList(field: FieldDefinition, operator: AnyOperator, rowValue: unknown, pillValues: unknown[]): boolean {
  if (operator === "!" || operator === "!*") {
    return pillValues.every((value) => !compareEq(field, rowValue, value));
  }
  return pillValues.some((value) => compareEq(field, rowValue, value));
}

function evalRange(field: FieldDefinition, rowValue: unknown, from: unknown, to: unknown): boolean {
  const cmpFrom = compareOrder(field, rowValue, from);
  const cmpTo = compareOrder(field, rowValue, to);
  return cmpFrom !== undefined && cmpTo !== undefined && cmpFrom >= 0 && cmpTo <= 0;
}

function toToken(pill: FilterPill, fieldsByName: Map<string, FieldDefinition>): Token | undefined {
  if (pill.invalid) return undefined;

  if (pill.kind === "and") return { kind: "and" };
  if (pill.kind === "or") return { kind: "or" };
  if (pill.kind === "open-bracket") return { kind: "open" };
  if (pill.kind === "close-bracket") return { kind: "close" };

  const field = fieldsByName.get(pill.fieldName);
  if (!field) return undefined;

  if (pill.kind === "value") {
    return {
      kind: "expr",
      eval: (row) => evalValue(field, pill.operator, row[field.name], pill.value),
    };
  }

  if (pill.kind === "list") {
    return {
      kind: "expr",
      eval: (row) => evalList(field, pill.operator, row[field.name], pill.values),
    };
  }

  return {
    kind: "expr",
    eval: (row) => evalRange(field, row[field.name], pill.from, pill.to),
  };
}

function withImplicitAnd(tokens: Token[]): Token[] {
  const result: Token[] = [];
  const isExprOrClose = (token: Token): boolean => token.kind === "expr" || token.kind === "close";
  const isExprOrOpen = (token: Token): boolean => token.kind === "expr" || token.kind === "open";

  for (const token of tokens) {
    const prev = result[result.length - 1];
    if (prev && isExprOrClose(prev) && isExprOrOpen(token)) {
      result.push({ kind: "and" });
    }
    result.push(token);
  }

  return result;
}

function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const operators: OpToken[] = [];
  const precedence = { or: 1, and: 2 } as const;

  for (const token of tokens) {
    if (token.kind === "expr") {
      output.push(token);
      continue;
    }

    if (token.kind === "open") {
      operators.push(token);
      continue;
    }

    if (token.kind === "close") {
      while (operators.length && operators[operators.length - 1].kind !== "open") {
        output.push(operators.pop() as OpToken);
      }
      if (operators.length && operators[operators.length - 1].kind === "open") {
        operators.pop();
      }
      continue;
    }

    while (operators.length) {
      const top = operators[operators.length - 1];
      if (top.kind === "open") break;
      if (!isBinaryOp(top)) {
        operators.pop();
        continue;
      }
      if (precedence[top.kind] >= precedence[token.kind]) {
        output.push(operators.pop() as OpToken);
        continue;
      }
      break;
    }
    operators.push(token);
  }

  while (operators.length) {
    const op = operators.pop() as OpToken;
    if (op.kind !== "open" && op.kind !== "close") output.push(op);
  }

  return output;
}

function evaluateRpn(tokens: Token[], row: Record<string, unknown>): boolean {
  const stack: boolean[] = [];

  for (const token of tokens) {
    if (token.kind === "expr") {
      stack.push(token.eval(row));
      continue;
    }

    if (!isBinaryOp(token)) continue;

    const right = stack.pop();
    const left = stack.pop();
    if (left === undefined || right === undefined) continue;
    stack.push(token.kind === "and" ? left && right : left || right);
  }

  return stack.length > 0 ? stack[stack.length - 1] : true;
}

export function buildAgGridExternalFilter(pills: FilterPill[], fields: FieldDefinition[]): AgGridExternalFilter {
  const fieldsByName = new Map(fields.map((field) => [field.name, field]));
  const tokens = withImplicitAnd(
    pills
      .map((pill) => toToken(pill, fieldsByName))
      .filter((token): token is Token => Boolean(token)),
  );
  const rpn = toRpn(tokens);
  const hasConditions = rpn.some((token) => token.kind === "expr");

  return {
    isExternalFilterPresent: () => hasConditions,
    doesExternalFilterPass: (row): boolean => {
      if (!hasConditions) return true;
      return evaluateRpn(rpn, asRecord(row));
    },
  };
}

export function syncAgGridExternalFilter(args: {
  api?: AgGridApi;
  pills: FilterPill[];
  fields: FieldDefinition[];
  onFilterChange?: (event: FilterChangeEvent) => void;
}): AgGridExternalFilter {
  const filter = buildAgGridExternalFilter(args.pills, args.fields);

  if (args.api?.setGridOption) {
    args.api.setGridOption("isExternalFilterPresent", filter.isExternalFilterPresent);
    args.api.setGridOption("doesExternalFilterPass", filter.doesExternalFilterPass);
  }

  args.api?.onFilterChanged?.();
  args.onFilterChange?.({ pills: args.pills, filter });

  return filter;
}