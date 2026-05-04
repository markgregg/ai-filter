import type { MouseEvent, MutableRefObject } from "react";
import { useDataSelector, useUiSelector } from "../../context";
import { FilterInput } from "./FilterInput";
import { usePillsAreaSelector } from "./PillsAreaContext";
import { reorderPillsForDrop } from "./pillReorder";
import { useInsertZoneDrop } from "./usePillDragDrop";
import styles from "./PillsArea.module.css";

export function InsertZone(props: {
  slot: number;
  dragFromRef: MutableRefObject<number | null>;
}): JSX.Element {
  const { slot, dragFromRef } = props;

  const setPills = useDataSelector((s) => s.setPills);

  const insertIndex = useUiSelector((s) => s.insertIndex);
  const selectedIds = useUiSelector((s) => s.selectedIds);
  const editingId = useUiSelector((s) => s.editingId);

  const onMoveInputToSlot = usePillsAreaSelector((s) => s.onMoveInputToSlot);

  const showInput = !selectedIds.length && !editingId;
  const isActive = insertIndex === slot && showInput;
  const {
    isDropTarget,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useInsertZoneDrop({
    dragFromRef,
    onDropFromIndex: (from) => {
      setPills((prev) => reorderPillsForDrop(prev, from, slot));
    },
  });

  const zoneClass = [styles.insertZone, isActive ? styles.activeZone : "", isDropTarget ? styles.dropTarget : ""]
    .filter(Boolean)
    .join(" ");

  function handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
    onMoveInputToSlot(slot);
  }

  return (
    <div
      className={zoneClass}
      data-ef="insert-zone"
      onMouseDown={handleMouseDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showInput && insertIndex === slot ? <FilterInput /> : null}
    </div>
  );
}
