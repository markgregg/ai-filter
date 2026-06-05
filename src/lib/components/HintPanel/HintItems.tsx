import { useEffect, useMemo, useRef, useState } from "react";
import type { Hint } from "../../types";
import { useHintPanelSelector } from "./HintPanelContext";
import { EfScrollArea } from "./EfScrollArea";
import { cx, preventDefaultMouseDown } from "../ui/utils";
import { GhostButton } from "../ui/GhostButton";
import { formatFieldValueForDisplay } from "../../parser";
import type { FieldDefinition } from "../../types";
import styles from "./HintPanel.module.less";

function HintItem({ entry }: { entry: { field: FieldDefinition; hint: Hint } }): JSX.Element {
  const isFavoritesSelected = useHintPanelSelector((s) => s.isFavoritesSelected);
  const currentField = useHintPanelSelector((s) => s.currentField);
  const selectedValues = useHintPanelSelector((s) => s.selectedValues);
  const onPickHint = useHintPanelSelector((s) => s.onPickHint);

  const hint = entry.hint;
  const fieldForHint = entry.field;

  let caption: string;
  let isHintSelected: boolean;

  if (hint.kind === "list") {
    caption = `${String(hint.operator)} (${hint.values.map((v) => formatFieldValueForDisplay(fieldForHint, v)).join(", ")})`;
    isHintSelected = hint.values.some((v) => selectedValues.has(formatFieldValueForDisplay(fieldForHint, v)));
  } else if (hint.kind === "range") {
    caption = `${formatFieldValueForDisplay(fieldForHint, hint.from)} to ${formatFieldValueForDisplay(fieldForHint, hint.to)}`;
    isHintSelected = selectedValues.has(caption);
  } else {
    const isDateField = fieldForHint.type === "date" || fieldForHint.type === "datetime";
    caption = isDateField ? formatFieldValueForDisplay(fieldForHint, hint.value) : hint.text;
    isHintSelected = selectedValues.has(caption);
  }

  const displayCaption = isFavoritesSelected
    ? `${fieldForHint.label ?? fieldForHint.name}: ${caption}`
    : caption;

  const capturedCaption = displayCaption;
  const capturedIsSelected = isHintSelected;
  const renderedCaption = fieldForHint.renderers?.hint?.({
    defaultText: capturedCaption,
    hint,
    value: hint.kind === "single" ? hint.value : undefined,
    values: hint.kind === "list" ? hint.values : undefined,
  });

  function handleClick(): void {
    onPickHint(fieldForHint, hint, capturedIsSelected);
  }

  return (
    <GhostButton
      type="button"
      className={cx(styles.hintRow, capturedIsSelected && styles.active)}
      onMouseDown={preventDefaultMouseDown}
      onClick={handleClick}
    >
      {renderedCaption ?? capturedCaption}
    </GhostButton>
  );
}

export function HintItems(): JSX.Element {
  const hintEntries = useHintPanelSelector((s) => s.hintEntries);
  const hintColumns = useHintPanelSelector((s) => s.hintColumns);
  const hintVirtualized = useHintPanelSelector((s) => s.hintVirtualized);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const itemHeight = 30;
  const shouldVirtualize = hintVirtualized && hintEntries.length > 0;

  useEffect(() => {
    if (!shouldVirtualize) return;
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    function handleScroll(): void {
      setScrollTop(viewportEl!.scrollTop);
    }

    function handleResize(): void {
      setViewportHeight(viewportEl!.clientHeight);
    }

    handleResize();
    viewportEl.addEventListener("scroll", handleScroll, { passive: true });

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(handleResize)
      : undefined;
    observer?.observe(viewportEl);

    return () => {
      viewportEl.removeEventListener("scroll", handleScroll);
      observer?.disconnect();
    };
  }, [shouldVirtualize]);

  const {
    renderedEntries,
    virtualOffsetTop,
    virtualTotalHeight,
  } = useMemo(() => {
    if (!shouldVirtualize) {
      return {
        renderedEntries: hintEntries,
        virtualOffsetTop: 0,
        virtualTotalHeight: 0,
      };
    }

    const columns = Math.max(1, hintColumns);
    const totalRows = Math.ceil(hintEntries.length / columns);
    const visibleRows = Math.max(1, Math.ceil(viewportHeight / itemHeight));
    const overscanRows = 3;

    const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - overscanRows);
    const endRow = Math.min(totalRows - 1, startRow + visibleRows + overscanRows * 2);

    const startIndex = startRow * columns;
    const endIndex = Math.min(hintEntries.length, (endRow + 1) * columns);

    return {
      renderedEntries: hintEntries.slice(startIndex, endIndex),
      virtualOffsetTop: startRow * itemHeight,
      virtualTotalHeight: totalRows * itemHeight,
    };
  }, [shouldVirtualize, hintEntries, hintColumns, viewportHeight, scrollTop]);

  const viewportStyle =
    hintColumns > 1
      ? {
          display: "grid",
          gridAutoFlow: "row",
          gridTemplateColumns: `repeat(${hintColumns}, 1fr)`,
        }
      : undefined;

  return (
    <EfScrollArea className={styles.values} viewportRef={viewportRef}>
      {!shouldVirtualize ? (
        <div data-ef="hint-items-grid" style={viewportStyle}>
          {hintEntries.map((entry, index) => (
            <HintItem
              key={`${entry.field.name}-${entry.hint.text}-${index}`}
              entry={entry}
            />
          ))}
        </div>
      ) : (
        <div data-ef="hint-items-virtualized" style={{ position: "relative", height: `${virtualTotalHeight}px` }}>
          <div
            data-ef="hint-items-grid"
            style={{
              position: "absolute",
              top: `${virtualOffsetTop}px`,
              left: 0,
              right: 0,
              ...(viewportStyle ?? {}),
            }}
          >
            {renderedEntries.map((entry, index) => (
              <HintItem
                key={`${entry.field.name}-${entry.hint.text}-${index}-${virtualOffsetTop}`}
                entry={entry}
              />
            ))}
          </div>
        </div>
      )}
    </EfScrollArea>
  );
}

