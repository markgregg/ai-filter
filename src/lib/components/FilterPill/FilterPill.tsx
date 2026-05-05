import type { CSSProperties, MouseEvent, MutableRefObject } from "react";
import { Switch } from "@base-ui/react/switch";
import { GhostButton } from "../ui/GhostButton";
import { useConfigSelector, useDataSelector, useUiSelector } from "../../context";
import { normalizePills, pillLabel } from "../../parser";
import { usePillsAreaSelector } from "../PillsArea/PillsAreaContext";
import { usePillDrag } from "../PillsArea/usePillDragDrop";
import type { FilterPill as FilterPillType, ListPill, RangePill, ValuePill } from "../../types";
import { PillEditor } from "../PillEditor/PillEditor";
import styles from "./FilterPill.module.css";

export function FilterPill(props: {
  pill: FilterPillType;
  index: number;
  dragFromRef: MutableRefObject<number | null>;
}): JSX.Element {
  const { pill, index, dragFromRef } = props;

  const fields = useConfigSelector((s) => s.fields);
  const pillMaxWidth = useConfigSelector((s) => s.pillMaxWidth);

  const pills = useDataSelector((s) => s.pills);
  const setPills = useDataSelector((s) => s.setPills);
  const setValuesByField = useDataSelector((s) => s.setValuesByField);
  const loadSetValues = useDataSelector((s) => s.loadSetValues);

  const selectedIds = useUiSelector((s) => s.selectedIds);
  const setSelectedIds = useUiSelector((s) => s.setSelectedIds);
  const editingId = useUiSelector((s) => s.editingId);
  const setEditingId = useUiSelector((s) => s.setEditingId);
  const setInsertIndex = useUiSelector((s) => s.setInsertIndex);

  const onFocusRoot = usePillsAreaSelector((s) => s.onFocusRoot);

  const selected = selectedIds.includes(pill.id);
  const isEditing = editingId === pill.id;
  const field = "fieldName" in pill ? fields.find((f) => f.name === pill.fieldName) : undefined;
  const { isDragging, handleDragStart, handleDragEnd } = usePillDrag({ index, dragFromRef });

  function handleClick(e: MouseEvent): void {
    if (isEditing) return;
    e.stopPropagation();
    setInsertIndex(index);
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds(
        selectedIds.includes(pill.id)
          ? selectedIds.filter((id) => id !== pill.id)
          : [...selectedIds, pill.id],
      );
      onFocusRoot();
      return;
    }
    setSelectedIds([pill.id]);
    onFocusRoot();
  }

  function handleDoubleClick(e: MouseEvent): void {
    e.stopPropagation();
    if (field?.type === "boolean") return;
    if (pill.kind === "value" || pill.kind === "list" || pill.kind === "range") {
      setEditingId(pill.id);
      setSelectedIds([pill.id]);
    }
  }

  function handleBooleanToggle(nextValue: boolean): void {
    if (field?.type !== "boolean") return;
    if (pill.kind !== "value") return;
    setPills((prev) =>
      normalizePills(
        prev.map((p) =>
          p.id === pill.id && p.kind === "value"
            ? { ...p, value: nextValue }
            : p,
        ),
      ),
    );
  }

  function handleDelete(e: MouseEvent): void {
    e.stopPropagation();
    setPills((prev) => normalizePills(prev.filter((p) => p.id !== pill.id)));
    setSelectedIds(selectedIds.filter((id) => id !== pill.id));
  }

  function handleMouseDown(e: MouseEvent): void {
    // Do NOT call e.preventDefault() here — it blocks HTML5 drag-and-drop
    // initiation in Firefox and some other browsers.
    // Focus is restored by onFocusRoot() in the click handler.
    void e;
  }

  // pills is only referenced to satisfy the linter — selectedIds/setInsertIndex
  // implicitly depend on it being stable across renders.
  void pills;

  const pillClass = [
    styles.pill,
    selected ? styles.selected : "",
    isDragging ? styles.dragging : "",
    "invalid" in pill && pill.invalid ? styles.invalid : "",
  ]
    .filter(Boolean)
    .join(" ");

  const labelClass = [styles.label, pillMaxWidth ? styles.truncated : ""]
    .filter(Boolean)
    .join(" ");

  const pillStyle = pillMaxWidth
    ? ({ "--ef-pill-max-width": pillMaxWidth } as CSSProperties)
    : undefined;

  const defaultLabel = pillLabel(pill, fields);
  const isBooleanValuePill = field?.type === "boolean" && pill.kind === "value";
  const booleanIsOn = isBooleanValuePill ? Boolean(pill.value) : false;
  const booleanValueText = isBooleanValuePill ? (booleanIsOn ? "on" : "off") : "";
  const renderedLabel =
    field && (pill.kind === "value" || pill.kind === "list" || pill.kind === "range")
      ? field.renderers?.pill?.({
          defaultText: defaultLabel,
          value: pill.kind === "value" ? pill.value : undefined,
          values:
            pill.kind === "list"
              ? pill.values
              : pill.kind === "range"
                ? [pill.from, pill.to]
                : undefined,
          pill,
        })
      : undefined;

  return (
    <div
      className={pillClass}
      style={pillStyle}
      data-ef="pill"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {isEditing &&
      field &&
      (pill.kind === "value" || pill.kind === "list" || pill.kind === "range") ? (
        <PillEditor
          pill={pill}
          field={field}
          setOptions={field.type === "set" ? setValuesByField[field.name] ?? [] : undefined}
          onLookupChange={field.type === "set" && typeof field.setValues === "function"
            ? (text) => { loadSetValues(field, text).catch(() => {}); }
            : undefined
          }
          onCommit={(next) => {
            setPills((prev) =>
              normalizePills(prev.map((p) => (p.id === next.id ? next : p))),
            );
            setEditingId(undefined);
          }}
          onCancel={() => setEditingId(undefined)}
        />
      ) : (
        <>
          {!isBooleanValuePill ? (
            <span className={labelClass}>{renderedLabel ?? defaultLabel}</span>
          ) : null}
          {isBooleanValuePill ? (
            <>
              <span className={styles.booleanFieldName}>
                {field?.label ?? field?.name}
              </span>
              <Switch.Root
                data-ef="boolean-toggle"
                aria-label={`Toggle ${field?.label ?? field?.name ?? "boolean"} value (currently ${booleanValueText})`}
                checked={booleanIsOn}
                className={`${styles.booleanToggleRoot} ${booleanIsOn ? styles.booleanToggleOn : styles.booleanToggleOff}`}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onCheckedChange={handleBooleanToggle}
              >
                <Switch.Thumb
                  className={`${styles.booleanToggleThumb} ${booleanIsOn ? styles.booleanToggleThumbOn : styles.booleanToggleThumbOff}`}
                  aria-hidden="true"
                >
                  {booleanIsOn ? "|" : "o"}
                </Switch.Thumb>
              </Switch.Root>
            </>
          ) : null}
          <GhostButton
            data-size="icon-sm"
            type="button"
            className={styles.deleteBtn}
            data-ef="pill-delete"
            onClick={handleDelete}
          >
            x
          </GhostButton>
        </>
      )}
    </div>
  );
}

// Re-export types that PillEditor needs, so callers don't need to import them
// from types.ts directly.
export type { ListPill, RangePill, ValuePill };
