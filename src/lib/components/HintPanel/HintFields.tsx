import { useEffect, useRef, type MouseEvent } from "react";
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
  const fields = useConfigSelector((s) => s.fields);
  const fieldColumns = useHintPanelSelector((s) => s.fieldColumns);

  const viewportStyle =
    fieldColumns > 1
      ? {
          display: "grid",
          gridTemplateColumns: `repeat(${fieldColumns}, 1fr)`,
        }
      : undefined;

  return (
    <ScrollArea.Root className={`${styles.fields} ${styles.scrollRoot}`}>
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
  );
}
