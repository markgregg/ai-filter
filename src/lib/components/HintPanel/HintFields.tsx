import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { GhostButton } from "../ui/GhostButton";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { useConfigSelector, useDataSelector } from "../../context";
import type { FieldDefinition } from "../../types";
import { useHintPanelSelector } from "./HintPanelContext";
import styles from "./HintPanel.module.css";

function FieldRow({ field }: { field: FieldDefinition }): JSX.Element {
  const hasPillSelected = useHintPanelSelector((s) => s.hasPillSelected);
  const fixedField = useHintPanelSelector((s) => s.fixedField);
  const effectiveFieldName = useHintPanelSelector((s) => s.effectiveFieldName);
  const inputField = useHintPanelSelector((s) => s.inputField);
  const toggleSelectedField = useHintPanelSelector((s) => s.toggleSelectedField);
  const selectField = useHintPanelSelector((s) => s.selectField);
  const onInsertField = useHintPanelSelector((s) => s.onInsertField);
  const aiMode = useHintPanelSelector((s) => s.aiMode);

  const fieldPillCount = useDataSelector(
    (s) => s.pills.filter((p) => "fieldName" in p && p.fieldName === field.name).length,
  );
  const atMax =
    !aiMode && field.maxInstances !== undefined && fieldPillCount >= field.maxInstances;

  const isLockedByPill = !aiMode && hasPillSelected && fixedField !== field.name;
  const isLockedByInput = !aiMode && Boolean(inputField) && inputField?.name !== field.name;
  const isLocked = isLockedByPill || isLockedByInput;
  const isSelected = effectiveFieldName === field.name;

  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (isSelected) {
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);

  function handleSelect(): void {
    if (!isLocked) toggleSelectedField(field.name);
  }

  function handleInsert(): void {
    selectField(field.name);
    onInsertField(field);
  }

  function handleInsertMouseDown(e: MouseEvent): void {
    e.preventDefault();
  }

  return (
    <div className={styles.fieldRow}>
      <GhostButton
        ref={ref}
        type="button"
        className={`${styles.fieldOption}${isSelected ? ` ${styles.active}` : ""}`}
        onClick={handleSelect}
        disabled={isLocked || atMax}
      >
        {field.label ?? field.name}
      </GhostButton>
      {!aiMode && (
        <GhostButton
          data-size="icon-sm"
          type="button"
          className={styles.fieldPlus}
          onMouseDown={handleInsertMouseDown}
          onClick={handleInsert}
          disabled={atMax}
          aria-label={`Insert ${field.label ?? field.name}`}
        >
          +
        </GhostButton>
      )}
    </div>
  );
}

export function HintFields(): JSX.Element {
  const rawFields = useConfigSelector((s) => s.fields);
  const hintFieldSearch = useConfigSelector((s) => s.hintFieldSearch);
  const [searchText, setSearchText] = useState("");

  const fields = useMemo(() => {
    const sorted = [...rawFields].sort((a, b) => {
      const aOrder = a.hintOrder ?? Infinity;
      const bOrder = b.hintOrder ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return rawFields.indexOf(a) - rawFields.indexOf(b);
    });
    if (!hintFieldSearch || !searchText.trim()) return sorted;
    const needle = searchText.trim().toLowerCase();
    return sorted.filter((f) => (f.label ?? f.name).toLowerCase().includes(needle));
  }, [rawFields, hintFieldSearch, searchText]);
  const fieldColumns = useHintPanelSelector((s) => s.fieldColumns);

  const viewportStyle =
    fieldColumns > 1
      ? {
          display: "grid",
          gridTemplateColumns: `repeat(${fieldColumns}, 1fr)`,
        }
      : undefined;

  return (
    <div className={styles.fields} style={{ display: "flex", flexDirection: "column" }}>
      {hintFieldSearch && (
        <div className={styles.fieldSearch}>
          <input
            data-ef="hint-field-search"
            type="text"
            className={styles.fieldSearchInput}
            placeholder="Search fields…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <ScrollArea.Root
        className={styles.scrollRoot}
        style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
      >
        <ScrollArea.Viewport className={styles.scrollViewport}>
          <div style={viewportStyle}>
            {fields.map((field) => (
              <FieldRow key={field.name} field={field} />
            ))}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className={styles.scrollbar}>
          <ScrollArea.Thumb className={styles.scrollThumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
