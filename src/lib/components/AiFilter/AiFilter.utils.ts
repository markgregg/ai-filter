import { findLeadingOperator, isPlausibleValue, operatorsForField } from "../../operators";
import { flattenTreeNodes } from "../../tree";
import type { FieldDefinition, FieldMatch, Hint, MatchRankingConfig } from "../../types";

export function matchesFromInput(args: {
  input: string;
  fields: FieldDefinition[];
  mode?: "simple" | "complex";
  setValuesByField: Record<string, string[]>;
  hintsByField: Record<string, Hint[]>;
  pillCountByField: Record<string, number>;
  favoriteFieldCounts?: Record<string, number>;
  recentByField?: Record<string, unknown[]>;
  matchRanking?: MatchRankingConfig | false;
}): FieldMatch[] {
  const raw = args.input;
  const needle = raw.trim().toLowerCase();
  if (!needle) return [];

  // Fields that have reached their maxInstances limit should not appear in suggestions.
  const availableFields = args.fields.filter((f) => {
    const maxInstances = args.mode === "simple" ? 1 : f.maxInstances;
    if (maxInstances === undefined) return true;
    return (args.pillCountByField[f.name] ?? 0) < maxInstances;
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
    const { op, rest: parsedRest } = findLeadingOperator(afterField);
    const valueText =
      op === "in" && (prefixField.type === "set" || prefixField.type === "tree")
        ? afterField
        : parsedRest;
    const lookupMinChars = prefixField.lookupMinChars ?? 0;

    // No value typed yet — suppress the dropdown.
    if (!valueText) return [];
    if (prefixField.type === "set" && valueText.length < lookupMinChars) return [];

    // Operator is present but not valid for this field — suppress.
    if (
      op !== undefined &&
      !(op === "in" && (prefixField.type === "set" || prefixField.type === "tree")) &&
      !operatorsForField(prefixField).includes(op)
    ) return [];

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

    if (prefixField.type === "tree") {
      const treeNodes = flattenTreeNodes(prefixField.treeValues);
      const directMatches = treeNodes.filter((node) =>
        node.value.toLowerCase().includes(valueNeedle),
      );
      const leafMatches = directMatches.filter((node) => node.isLeaf);
      const effectiveMatches = leafMatches.length > 0 ? leafMatches : directMatches;
      for (const node of effectiveMatches) {
        if (node.isLeaf) {
          results.push({
            type: "set-value",
            field: prefixField,
            text: node.value,
            setValue: node.value,
            operator: op,
            rank: prefixField.precedence * 100 + 12,
          });
        } else {
          results.push({
            type: "hint",
            field: prefixField,
            text: node.value,
            hint: node.leafValues.length > 1
              ? {
                  kind: "list",
                  text: node.value,
                  operator: "=",
                  values: node.leafValues,
                }
              : {
                  kind: "single",
                  text: node.value,
                  operator: "=",
                  value: node.leafValues[0],
                },
            operator: op,
            rank: prefixField.precedence * 100 + 11,
          });
        }
      }
    }

    // Value-candidate for non-set fields (or set with no matching hints/values).
    const alreadyMatched = results.length > 0;
    if (!alreadyMatched && prefixField.type !== "set" && prefixField.type !== "tree" && isPlausibleValue(prefixField, valueText)) {
      results.push({
        type: "value-candidate",
        field: prefixField,
        text: valueText,
        operator: op,
        rank: prefixField.precedence * 100 + 1,
      });
    }

    return results.sort((a, b) => {
      const aFav = args.favoriteFieldCounts?.[a.field.name] ?? 0;
      const bFav = args.favoriteFieldCounts?.[b.field.name] ?? 0;
      if (aFav !== bFav) return bFav - aFav;
      return b.rank - a.rank;
    });
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
      const lookupMinChars = field.lookupMinChars ?? 0;
      if (matchNeedle.length < lookupMinChars) {
        continue;
      }
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

    if (field.type === "tree") {
      const treeNodes = flattenTreeNodes(field.treeValues);
      const directMatches = treeNodes.filter((node) =>
        node.value.toLowerCase().includes(matchNeedle),
      );
      const leafMatches = directMatches.filter((node) => node.isLeaf);
      const effectiveMatches = leafMatches.length > 0 ? leafMatches : directMatches;
      for (const node of effectiveMatches) {
        if (node.isLeaf) {
          results.push({
            type: "set-value",
            field,
            text: node.value,
            setValue: node.value,
            operator: leadingOp,
            rank: field.precedence * 100 + 12,
          });
        } else {
          results.push({
            type: "hint",
            field,
            text: node.value,
            hint: node.leafValues.length > 1
              ? {
                  kind: "list",
                  text: node.value,
                  operator: "=",
                  values: node.leafValues,
                }
              : {
                  kind: "single",
                  text: node.value,
                  operator: "=",
                  value: node.leafValues[0],
                },
            operator: leadingOp,
            rank: field.precedence * 100 + 11,
          });
        }
      }
      continue;
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
    const aFav = args.favoriteFieldCounts?.[a.field.name] ?? 0;
    const bFav = args.favoriteFieldCounts?.[b.field.name] ?? 0;
    if (aFav !== bFav) {
      return bFav - aFav;
    }
    if (a.field.precedence !== b.field.precedence) {
      return b.field.precedence - a.field.precedence;
    }
    const aSet = a.field.type === "set" || a.field.type === "tree" ? 1 : 0;
    const bSet = b.field.type === "set" || b.field.type === "tree" ? 1 : 0;
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
