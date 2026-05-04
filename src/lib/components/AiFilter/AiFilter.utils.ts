import { findLeadingOperator, isPlausibleValue, operatorsForField } from "../../operators";
import type { FieldDefinition, FieldMatch, Hint, MatchRankingConfig } from "../../types";

export function matchesFromInput(args: {
  input: string;
  fields: FieldDefinition[];
  setValuesByField: Record<string, string[]>;
  hintsByField: Record<string, Hint[]>;
  pillCountByField: Record<string, number>;
  recentByField?: Record<string, unknown[]>;
  matchRanking?: MatchRankingConfig | false;
}): FieldMatch[] {
  const raw = args.input;
  const needle = raw.trim().toLowerCase();
  if (!needle) return [];

  // Fields that have reached their maxInstances limit should not appear in suggestions.
  const availableFields = args.fields.filter((f) => {
    if (f.maxInstances === undefined) return true;
    return (args.pillCountByField[f.name] ?? 0) < f.maxInstances;
  });

  // ── Case 1: input starts with a recognised field name ──────────────────────
  // Covers "Name something" (starts with "name ") and "Name " (raw has trailing
  // whitespace that trim() strips, leaving needle === field name).
  const prefixField = availableFields.find((f) => {
    const fn = f.name.toLowerCase();
    return needle.startsWith(`${fn} `) || (needle === fn && raw !== raw.trimEnd());
  });

  if (prefixField) {
    const afterField = needle.slice(prefixField.name.toLowerCase().length).trim();
    const { op, rest: valueText } = findLeadingOperator(afterField);

    // No value typed yet — suppress the dropdown.
    if (!valueText) return [];

    // Operator is present but not valid for this field — suppress.
    if (op !== undefined && !operatorsForField(prefixField).includes(op)) return [];

    const valueNeedle = valueText.toLowerCase();
    const results: FieldMatch[] = [];
    const fieldHints = args.hintsByField[prefixField.name] ?? [];

    for (const hint of fieldHints) {
      if (hint.text.toLowerCase().includes(valueNeedle)) {
        results.push({
          type: "hint",
          field: prefixField,
          text: hint.text,
          hint,
          operator: op,
          rank: prefixField.precedence * 100 + 5,
        });
      }
    }

    if (prefixField.type === "set" && fieldHints.length === 0) {
      for (const value of args.setValuesByField[prefixField.name] ?? []) {
        const text = String(value);
        if (text.toLowerCase().includes(valueNeedle)) {
          results.push({
            type: "set-value",
            field: prefixField,
            text,
            setValue: text,
            operator: op,
            rank: prefixField.precedence * 100 + 10,
          });
        }
      }
    }

    // Value-candidate for non-set fields (or set with no matching hints/values).
    const alreadyMatched = results.length > 0;
    if (!alreadyMatched && prefixField.type !== "set" && isPlausibleValue(prefixField, valueText)) {
      results.push({
        type: "value-candidate",
        field: prefixField,
        text: valueText,
        operator: op,
        rank: prefixField.precedence * 100 + 1,
      });
    }

    return results.sort((a, b) => b.rank - a.rank);
  }

  // ── Case 2: no field prefix ─────────────────────────────────────────────────
  // The input may optionally start with an operator (e.g. "= 60", "> 40").
  const { op: leadingOp, rest: afterOp } = findLeadingOperator(needle);
  const valueNeedle = afterOp; // empty string when only an operator was typed

  // If the user typed only an operator with no value yet, suppress.
  if (leadingOp !== undefined && !valueNeedle) return [];

  const results: FieldMatch[] = [];

  for (const field of availableFields) {
    // When a leading operator was typed, skip fields that don't support it.
    if (leadingOp !== undefined && !operatorsForField(field).includes(leadingOp)) continue;

    const label = field.label ?? field.name;

    // Field-name suggestions are only relevant when the user hasn't typed an operator.
    if (leadingOp === undefined) {
      const fieldHit =
        field.name.toLowerCase().includes(needle) || label.toLowerCase().includes(needle);
      if (fieldHit) {
        results.push({ type: "field", field, text: label, rank: field.precedence * 100 });
      }
    }

    const matchNeedle = leadingOp !== undefined ? valueNeedle : needle;

    if (field.type === "set") {
      const fieldHints = args.hintsByField[field.name] ?? [];
      if (fieldHints.length > 0) {
        for (const hint of fieldHints) {
          if (hint.text.toLowerCase().includes(matchNeedle)) {
            results.push({
              type: "hint",
              field,
              text: hint.text,
              hint,
              operator: leadingOp,
              rank: field.precedence * 100 + 5,
            });
          }
        }
      } else {
        for (const value of args.setValuesByField[field.name] ?? []) {
          const text = String(value);
          if (text.toLowerCase().includes(matchNeedle)) {
            results.push({
              type: "set-value",
              field,
              text,
              setValue: text,
              operator: leadingOp,
              rank: field.precedence * 100 + 10,
            });
          }
        }
      }
      continue; // set fields never get a free-text value-candidate
    }

    const fieldHints = args.hintsByField[field.name] ?? [];
    for (const hint of fieldHints) {
      if (hint.text.toLowerCase().includes(matchNeedle)) {
        results.push({
          type: "hint",
          field,
          text: hint.text,
          hint,
          operator: leadingOp,
          rank: field.precedence * 100 + 5,
        });
      }
    }

    const alreadyMatched = results.some(
      (r) => r.field.name === field.name && (r.type === "hint" || r.type === "set-value"),
    );
    if (!alreadyMatched && isPlausibleValue(field, matchNeedle)) {
      results.push({
        type: "value-candidate",
        field,
        text: matchNeedle,
        operator: leadingOp,
        rank: field.precedence * 100 + 1,
      });
    }
  }

  const deduped = new Map<string, FieldMatch>();
  for (const match of results) {
    const hintKey =
      match.type === "hint"
        ? JSON.stringify(match.hint)
        : match.type === "set-value"
          ? String(match.setValue ?? match.text)
          : match.text;
    const key = `${match.field.name}|${match.type}|${hintKey}`;
    const current = deduped.get(key);
    if (!current || match.rank > current.rank) {
      deduped.set(key, match);
    }
  }

  const defaultSorted = Array.from(deduped.values()).sort((a, b) => {
    if (a.field.precedence !== b.field.precedence) {
      return b.field.precedence - a.field.precedence;
    }
    const aSet = a.field.type === "set" ? 1 : 0;
    const bSet = b.field.type === "set" ? 1 : 0;
    if (aSet !== bSet) {
      return bSet - aSet;
    }
    return a.text.localeCompare(b.text);
  });

  const ranking = args.matchRanking;
  const rankingEnabled = ranking !== false && ((ranking?.enabled ?? false) || Boolean(ranking));
  if (!rankingEnabled) {
    return defaultSorted;
  }

  const precedenceWeight = ranking?.precedenceWeight ?? 1;
  const usageWeight = ranking?.usageWeight ?? 4;
  const recencyWeight = ranking?.recencyWeight ?? 3;
  const exactnessWeight = ranking?.exactnessWeight ?? 5;
  const recentByField = args.recentByField ?? {};

  function exactnessScore(match: FieldMatch): number {
    const target = needle;
    if (!target) return 0;

    const text = match.text.toLowerCase();
    const fieldName = match.field.name.toLowerCase();
    const fieldLabel = (match.field.label ?? "").toLowerCase();

    if (match.type === "field") {
      if (fieldName === target || fieldLabel === target) return 4;
      if (fieldName.startsWith(target) || fieldLabel.startsWith(target)) return 3;
      if (fieldName.includes(target) || fieldLabel.includes(target)) return 2;
      return 1;
    }

    if (text === target) return 4;
    if (text.startsWith(target)) return 3;
    if (text.includes(target)) return 2;
    return 1;
  }

  function usageAndRecencyScore(match: FieldMatch): { usage: number; recency: number } {
    const recent = recentByField[match.field.name] ?? [];
    const usage = recent.length;

    const valueText =
      match.type === "hint" && match.hint?.kind === "single"
        ? String(match.hint.value)
        : match.type === "set-value"
          ? String(match.setValue ?? match.text)
          : match.text;

    const index = recent.findIndex((item) => String(item).toLowerCase() === valueText.toLowerCase());
    const recency = index >= 0 ? Math.max(0, 10 - index) : 0;
    return { usage, recency };
  }

  return defaultSorted
    .map((match) => {
      const { usage, recency } = usageAndRecencyScore(match);
      const intrinsicRank = match.rank % 100;
      const score =
        match.field.precedence * precedenceWeight +
        usage * usageWeight +
        recency * recencyWeight +
        exactnessScore(match) * exactnessWeight +
        intrinsicRank * 0.01;
      return { match, score };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.match.text.localeCompare(b.match.text);
    })
    .map((entry) => entry.match);
}
