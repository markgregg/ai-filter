import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { useConfigSelector, useDataSelector, useUiSelector } from "../../context";
import { dedupeHintsByIdentity, inferHintColumns, toSingleHints } from "../../hints";
import { findLeadingOperator, operatorsForField } from "../../operators";
import type { AnyOperator, FieldDefinition, Hint } from "../../types";
import { HintFields } from "./HintFields";
import { HintItems } from "./HintItems";
import { HintOperators } from "./HintOperators";
import { HintPanelContext } from "./HintPanelContext";
import styles from "./HintPanel.module.css";

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
  const hintsEnabled = useConfigSelector((s) => s.hintsEnabled);
  const inputValue = useUiSelector((s) => s.inputValue);
  const focused = useUiSelector((s) => s.focused);
  const selectedIds = useUiSelector((s) => s.selectedIds);
  const pills = useDataSelector((s) => s.pills);
  const recentByField = useDataSelector((s) => s.recentByField);
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
  const currentField = fields.find((f) => f.name === effectiveFieldName);

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
          values.add(String(pill.value));
        } else if (pill.kind === "list") {
          pill.values.forEach((v) => values.add(String(v)));
        } else if (pill.kind === "range") {
          values.add(`${String(pill.from)} to ${String(pill.to)}`);
        }
      });
    return values;
  }, [currentField, pills, selectedIds]);

  const recent = useMemo(
    () => toSingleHints(recentByField[currentField?.name ?? ""] ?? []),
    [recentByField, currentField?.name],
  );

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

  const effectiveHintColumns = props.hintColumns ?? inferHintColumns(hints.length);
  const useHintVirtualization = Boolean(props.hintVirtualized) && hints.length >= 80;

  const toggleSelectedField = useCallback(
    (name: string) => setSelectedField((prev) => (prev === name ? undefined : name)),
    [],
  );

  const selectField = useCallback((name: string) => setSelectedField(name), []);

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
    hints,
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
    toggleSelectedField,
    selectField,
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
        {!props.aiMode && <HintOperators />}
        <div className={styles.body} style={bodyStyle}>
          <HintFields />
          <HintItems />
        </div>
      </div>
    </HintPanelContext.Provider>
  );
}

