import { operatorsForField } from "../../operators";
import { resolveNlpExpression } from "../../nlpResolver";
import type { FieldDefinition, FilterPill } from "../../types";
import type { NlpResolveOptions } from "../../nlpResolver";

const OPERATOR_LABELS: Record<string, string> = {
  "=": "= (equals)",
  "!": "! (not equals)",
  ">": "> (greater than)",
  "<": "< (less than)",
  ">=": ">= (greater than or equal)",
  "<=": "<= (less than or equal)",
  "*": "* (contains)",
  "!*": "!* (not contains)",
  "<*": "<* (starts with)",
  ">*": ">* (ends with)",
  in: "in (comma-separated list)",
};

export function buildFilterPrompt(
  query: string,
  fields: FieldDefinition[],
  setValuesByField: Record<string, string[]>,
): string {
  const fieldLines = fields
    .map((f) => {
      const ops = operatorsForField(f).map((op) => OPERATOR_LABELS[op] ?? op);
      const setVals =
        f.type === "set"
          ? Array.isArray(f.setValues)
            ? f.setValues
            : (setValuesByField[f.name] ?? [])
          : [];
      const valuesNote = setVals.length ? `; allowed values: ${setVals.join(", ")}` : "";
      return `- ${f.name} (${f.type}): operators: ${ops.join(", ")}${valuesNote}`;
    })
    .join("\n");

  // Keep the prompt as short as possible — prefill time is linear with tokens.
  return `Convert the query to filter expressions. Rules: one expression per line, format "fieldName operator value". Use AND, OR, ( and ) on their own lines for logical grouping. Exact field names only, no explanations.
Fields:
${fieldLines}
Query: ${query}
Expressions:`;
}

export function parseFilterResponse(
  text: string,
  fields: FieldDefinition[],
  options?: NlpResolveOptions,
): FilterPill[] {
  const LOGICAL_TOKEN_RE = /^(AND|OR|\(|\))$/i;

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .map((l) => l.replace(/^\d+[.)]\s*/, ""))
    .filter((l) => l && !l.startsWith("```") && !l.startsWith("#") && !l.startsWith("//"))
    .filter((l) => l.includes(" ") || LOGICAL_TOKEN_RE.test(l));

  const pills: FilterPill[] = [];
  for (const line of lines) {
    const pill = resolveNlpExpression(line, fields, options);
    if (pill) {
      pills.push(pill);
    }
  }
  return pills;
}

export async function aiToFilterPills(
  query: string,
  fields: FieldDefinition[],
  setValuesByField: Record<string, string[]>,
  resolve: (prompt: string) => Promise<string>,
  options?: NlpResolveOptions,
): Promise<FilterPill[]> {
  const prompt = buildFilterPrompt(query, fields, setValuesByField);
  const text = await resolve(prompt);
  return parseFilterResponse(text, fields, options);
}

