import { useCallback, useState } from "react";
import type { DragEvent, MutableRefObject } from "react";

export function usePillDrag(props: {
  index: number;
  dragFromRef: MutableRefObject<number | null>;
}): {
  isDragging: boolean;
  handleDragStart: (e: DragEvent) => void;
  handleDragEnd: () => void;
} {
  const { index, dragFromRef } = props;
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e: DragEvent) => {
    // setData is required for Firefox to recognise the drag operation.
    // dataTransfer may be absent in test environments (JSDOM).
    if (e.dataTransfer) {
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
    }
    dragFromRef.current = index;
    setIsDragging(true);
  }, [dragFromRef, index]);

  const handleDragEnd = useCallback(() => {
    dragFromRef.current = null;
    setIsDragging(false);
  }, [dragFromRef]);

  return { isDragging, handleDragStart, handleDragEnd };
}

export function useInsertZoneDrop(props: {
  dragFromRef: MutableRefObject<number | null>;
  onDropFromIndex: (fromIndex: number) => void;
}): {
  isDropTarget: boolean;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: () => void;
  handleDrop: () => void;
} {
  const { dragFromRef, onDropFromIndex } = props;
  const [isDropTarget, setIsDropTarget] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (dragFromRef.current !== null) setIsDropTarget(true);
  }, [dragFromRef]);

  const handleDragLeave = useCallback(() => {
    setIsDropTarget(false);
  }, []);

  const handleDrop = useCallback(() => {
    setIsDropTarget(false);
    if (dragFromRef.current === null) return;
    onDropFromIndex(dragFromRef.current);
    dragFromRef.current = null;
  }, [dragFromRef, onDropFromIndex]);

  return { isDropTarget, handleDragOver, handleDragLeave, handleDrop };
}
