import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { useConfigSelector, useDataSelector, useUiSelector } from "../../context";
import { dedupeHintsByIdentity, inferHintColumns, toSingleHints } from "../../hints";
import { findLeadingOperator, operatorsForField } from "../../operators";
import { formatFieldValueForDisplay } from "../../parser";
import type { AnyOperator, FieldDefinition, Hint } from "../../types";
import { HintFields } from "./HintFields";
import { HintItems } from "./HintItems";
import { HintOperators } from "./HintOperators";
import { HintPanelContext } from "./HintPanelContext";
import styles from "./HintPanel.module.less";

const FAVORITES_FIELD_NAME = "__favorites__";

function hintMatchesText(hint: Hint, needle: string): boolean {
  if (hint.text.toLowerCase().includes(needle)) return true;

  if (hint.kind === "single") {
    return String(hint.value).toLowerCase().includes(needle);
  }

  if (hint.kind === "list") {
    return hint.values.some((v) => String(v).toLowerCase().includes(needle));
  }

  return (
    String(hint.from).toLowerCase().includes(needle) ||
    String(hint.to).toLowerCase().includes(needle)
  );
}

export function HintPanel(props: {
  onPickHint: (field: FieldDefinition, hint: Hint, isSelected: boolean) => void;
  onPickOperator: (field: FieldDefinition, operator: AnyOperator) => void;
  onInsertField: (field: FieldDefinition) => void;
  onInsertLogical: (token: string) => void;
  /** True when the filter is in AI natural-language input mode. */
  aiMode?: boolean;
  /** Called with plain text to append to the AI query input. */
  onAiAppendText?: (text: string) => void;
  /** Override the max-height of the fields+hints body (e.g. `"20rem"`). */
  maxHeight?: string;
  /** Number of columns for the hints list. Defaults to 1. */
  hintColumns?: number;
  /** Enable virtualized rendering for large hint lists. */
  hintVirtualized?: boolean;
  /** Keep panel visible regardless of focus state. */
  forceVisible?: boolean;
}): JSX.Element | null {
  const fields = useConfigSelector((s) => s.fields);
  const maxFavorites = useConfigSelector((s) => s.maxFavorites);
  const hintsEnabled = useConfigSelector((s) => s.hintsEnabled);
  const inputValue = useUiSelector((s) => s.inputValue);
  const focused = useUiSelector((s) => s.focused);
  const selectedIds = useUiSelector((s) => s.selectedIds);
  const editingId = useUiSelector((s) => s.editingId);
  const hintValueFilterText = useUiSelector((s) => s.hintValueFilterText);
  const pills = useDataSelector((s) => s.pills);
  const recentByField = useDataSelector((s) => s.recentByField);
  const favoriteCountsByField = useDataSelector((s) => s.favoriteCountsByField);
  const hintsByField = useDataSelector((s) => s.hintsByField);
  const loadHints = useDataSelector((s) => s.loadHints);

  const visible = focused || Boolean(props.forceVisible);

  const [selectedField, setSelectedField] = useState<string | undefined>(fields[0]?.name);
  const [fieldHints, setFieldHints] = useState<Record<string, Hint[]>>({});

  const { inputField, inputOperator } = useMemo<{
    inputField: FieldDefinition | undefined;
    inputOperator: AnyOperator | undefined;
  }>(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return { inputField: undefined, inputOperator: undefined };
    for (const f of fields) {
      if (trimmed.toLowerCase().startsWith(`${f.name.toLowerCase()} `)) {
        const afterField = trimmed.slice(f.name.length).trim();
        const { op } = findLeadingOperator(afterField);
        return { inputField: f, inputOperator: op as AnyOperator | undefined };
      }
    }
    return { inputField: undefined, inputOperator: undefined };
  }, [inputValue, fields]);

  const selectedPillField = useMemo(() => {
    if (!selectedIds.length) return undefined;
    const selected = pills.filter((p) => selectedIds.includes(p.id));
    const firstWithField = selected.find((p) => "fieldName" in p);
    if (!firstWithField || !("fieldName" in firstWithField)) return undefined;
    return firstWithField.fieldName;
  }, [pills, selectedIds]);

  useEffect(() => {
    if (selectedPillField) {
      setSelectedField(selectedPillField);
    }
  }, [selectedPillField]);

  const hasPillSelected = Boolean(selectedPillField);
  const fixedField = selectedPillField ?? inputField?.name;
  const effectiveFieldName = fixedField ?? selectedField ?? fields[0]?.name;
  const isFavoritesSelected = effectiveFieldName === FAVORITES_FIELD_NAME;
  const currentField = fields.find((f) => f.name === effectiveFieldName) ?? fields[0];

  const operators = useMemo(
    () => (currentField ? operatorsForField(currentField) : []),
    [currentField],
  );

  const activeOperator = useMemo<AnyOperator | undefined>(() => {
    if (selectedIds.length) {
      const pill = pills.find(
        (p) =>
          selectedIds.includes(p.id) &&
          "fieldName" in p &&
          p.fieldName === currentField?.name &&
          (p.kind === "value" || p.kind === "list"),
      );
      if (pill && (pill.kind === "value" || pill.kind === "list")) return pill.operator;
    }
    return inputOperator;
  }, [currentField?.name, inputOperator, pills, selectedIds]);

  const selectedValues = useMemo(() => {
    if (!currentField) return new Set<string>();
    const values = new Set<string>();
    pills
      .filter((pill) => selectedIds.includes(pill.id))
      .forEach((pill) => {
        if (!("fieldName" in pill) || pill.fieldName !== currentField.name) return;
        if (pill.kind === "value") {
          values.add(formatFieldValueForDisplay(currentField, pill.value));
        } else if (pill.kind === "list") {
          pill.values.forEach((v) => values.add(formatFieldValueForDisplay(currentField, v)));
        } else if (pill.kind === "range") {
          values.add(
            `${formatFieldValueForDisplay(currentField, pill.from)} to ${formatFieldValueForDisplay(currentField, pill.to)}`,
          );
        }
      });
    return values;
  }, [currentField, pills, selectedIds]);

  const recent = useMemo(
    () => toSingleHints(recentByField[currentField?.name ?? ""] ?? []),
    [recentByField, currentField?.name],
  );

  const favoritesHintEntries = useMemo(() => {
    if (maxFavorites === undefined) return [] as Array<{ field: FieldDefinition; hint: Hint; count: number }>;

    const entries: Array<{ field: FieldDefinition; hint: Hint; count: number }> = [];
    for (const [fieldName, valueCounts] of Object.entries(favoriteCountsByField)) {
      const field = fields.find((f) => f.name === fieldName);
      if (!field) continue;
      for (const [encoded, count] of Object.entries(valueCounts)) {
        let value: unknown = encoded;
        try {
          value = JSON.parse(encoded);
        } catch {
          value = encoded;
        }
        entries.push({
          field,
          hint: {
            kind: "single",
            text: formatFieldValueForDisplay(field, value),
            operator: "=",
            value,
          },
          count,
        });
      }
    }

    return entries
      .sort((a, b) => b.count - a.count)
      .slice(0, Math.max(0, maxFavorites));
  }, [favoriteCountsByField, fields, maxFavorites]);

  const showFavoritesField = maxFavorites !== undefined;

  const hints = useMemo(
    () => {
      const fieldName = currentField?.name ?? "";
      // Prefer hintsByField from context (reactive to async updates) over the
      // locally-cached fieldHints state which is only set on initial load.
      const ctxHints = hintsByField[fieldName];
      const activeHints = ctxHints !== undefined ? ctxHints : (fieldHints[fieldName] ?? []);
      return dedupeHintsByIdentity([...recent, ...activeHints]);
    },
    [recent, hintsByField, fieldHints, currentField?.name],
  );

  const filteredHints = useMemo(() => {
    if (isFavoritesSelected) {
      return favoritesHintEntries.map((entry) => entry.hint);
    }

    const needle = hintValueFilterText.trim().toLowerCase();
    if (!needle) return hints;
    if (!editingId || !currentField) return hints;

    const editingPill = pills.find((p) => p.id === editingId);
    if (!editingPill || !("fieldName" in editingPill)) return hints;
    if (editingPill.fieldName !== currentField.name) return hints;
    if (editingPill.kind !== "value" && editingPill.kind !== "list") return hints;

    return hints.filter((hint) => hintMatchesText(hint, needle));
  }, [isFavoritesSelected, favoritesHintEntries, hintValueFilterText, hints, editingId, currentField, pills]);

  const hintEntries = useMemo(() => {
    if (isFavoritesSelected) {
      return favoritesHintEntries.map((entry) => ({ field: entry.field, hint: entry.hint }));
    }
    if (!currentField) return [] as Array<{ field: FieldDefinition; hint: Hint }>;
    return filteredHints.map((hint) => ({ field: currentField, hint }));
  }, [isFavoritesSelected, favoritesHintEntries, currentField, filteredHints]);

  const effectiveHintColumns = props.hintColumns ?? inferHintColumns(filteredHints.length);
  const useHintVirtualization = Boolean(props.hintVirtualized) && filteredHints.length >= 80;

  const toggleSelectedField = useCallback(
    (name: string) => setSelectedField((prev) => (prev === name ? undefined : name)),
    [],
  );

  const selectField = useCallback((name: string) => setSelectedField(name), []);
  const selectFavorites = useCallback(() => setSelectedField(FAVORITES_FIELD_NAME), []);

  useEffect(() => {
    if (!hintsEnabled || !visible) return;
    const fieldsToLoad = currentField ? [currentField] : fields;
    fieldsToLoad.forEach((field) => {
      loadHints(field)
        .then((h) => {
          setFieldHints((prev) => ({ ...prev, [field.name]: h }));
        })
        .catch(() => {
          setFieldHints((prev) => ({ ...prev, [field.name]: [] }));
        });
    });
  }, [currentField, fields, visible, hintsEnabled, loadHints]);

  if (!hintsEnabled || !visible) return null;
  if (!currentField) return null;

  const ctxValue = {
    currentField,
    operators,
    hints: filteredHints,
    hintEntries,
    activeOperator,
    selectedValues,
    hasPillSelected,
    fixedField,
    effectiveFieldName,
    inputField,
    aiMode: props.aiMode ?? false,
    onAiAppendText: props.onAiAppendText ?? (() => undefined),
    hintColumns: effectiveHintColumns,
    hintVirtualized: useHintVirtualization,
    // Keep fields list single-column to avoid crowding the hints pane on large datasets.
    fieldColumns: 1,
    favoritesFieldName: FAVORITES_FIELD_NAME,
    showFavoritesField,
    isFavoritesSelected,
    toggleSelectedField,
    selectField,
    selectFavorites,
    onPickHint: props.onPickHint,
    onPickOperator: props.onPickOperator,
    onInsertField: props.onInsertField,
    onInsertLogical: props.onInsertLogical,
  };

  const bodyStyle: React.CSSProperties = {
    ...(props.maxHeight ? { maxHeight: props.maxHeight } : {}),
  };

  return (
    <HintPanelContext.Provider value={ctxValue}>
      <div className={styles.dropdown} role="listbox" aria-label="Hints">
        {!props.aiMode && !isFavoritesSelected && <HintOperators />}
        <div className={styles.body} style={bodyStyle}>
          <HintFields />
          <HintItems />
        </div>
      </div>
    </HintPanelContext.Provider>
  );
}


