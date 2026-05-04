import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { GhostButton } from "../ui/GhostButton";
import { ScrollArea } from "@base-ui/react/scroll-area";
import type { Hint } from "../../types";
import { useHintPanelSelector } from "./HintPanelContext";
import styles from "./HintPanel.module.css";

function HintItem({ hint, index }: { hint: Hint; index: number }): JSX.Element {
  const currentField = useHintPanelSelector((s) => s.currentField);
  const selectedValues = useHintPanelSelector((s) => s.selectedValues);
  const onPickHint = useHintPanelSelector((s) => s.onPickHint);

  let caption = hint.text;
  let isHintSelected: boolean;

  if (hint.kind === "list") {
    caption = `${String(hint.operator)} (${hint.values.map((v) => String(v)).join(", ")})`;
    isHintSelected = hint.values.some((v) => selectedValues.has(String(v)));
  } else if (hint.kind === "range") {
    caption = `${String(hint.from)} to ${String(hint.to)}`;
    isHintSelected = selectedValues.has(caption);
  } else {
    isHintSelected = selectedValues.has(String(hint.value));
  }

  const capturedCaption = caption;
  const capturedIsSelected = isHintSelected;
  const renderedCaption = currentField.renderers?.hint?.({
    defaultText: capturedCaption,
    hint,
    value: hint.kind === "single" ? hint.value : undefined,
    values: hint.kind === "list" ? hint.values : undefined,
  });

  function handleClick(): void {
    onPickHint(currentField, hint, capturedIsSelected);
  }

  function handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
  }

  void index;

  return (
    <GhostButton
      type="button"
      className={`${styles.hintRow}${capturedIsSelected ? ` ${styles.active}` : ""}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {renderedCaption ?? capturedCaption}
    </GhostButton>
  );
}

export function HintItems(): JSX.Element {
  const hints = useHintPanelSelector((s) => s.hints);
  const hintColumns = useHintPanelSelector((s) => s.hintColumns);
  const hintVirtualized = useHintPanelSelector((s) => s.hintVirtualized);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const itemHeight = 30;
  const shouldVirtualize = hintVirtualized && hints.length > 0;

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
    renderedHints,
    virtualOffsetTop,
    virtualTotalHeight,
  } = useMemo(() => {
    if (!shouldVirtualize) {
      return {
        renderedHints: hints,
        virtualOffsetTop: 0,
        virtualTotalHeight: 0,
      };
    }

    const columns = Math.max(1, hintColumns);
    const totalRows = Math.ceil(hints.length / columns);
    const visibleRows = Math.max(1, Math.ceil(viewportHeight / itemHeight));
    const overscanRows = 3;

    const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - overscanRows);
    const endRow = Math.min(totalRows - 1, startRow + visibleRows + overscanRows * 2);

    const startIndex = startRow * columns;
    const endIndex = Math.min(hints.length, (endRow + 1) * columns);

    return {
      renderedHints: hints.slice(startIndex, endIndex),
      virtualOffsetTop: startRow * itemHeight,
      virtualTotalHeight: totalRows * itemHeight,
    };
  }, [shouldVirtualize, hints, hintColumns, viewportHeight, scrollTop]);

  const viewportStyle =
    hintColumns > 1
      ? {
          display: "grid",
          gridAutoFlow: "row",
          gridTemplateColumns: `repeat(${hintColumns}, 1fr)`,
        }
      : undefined;

  return (
    <ScrollArea.Root className={`${styles.values} ${styles.scrollRoot}`}>
      <ScrollArea.Viewport ref={viewportRef} className={styles.scrollViewport}>
        {!shouldVirtualize ? (
          <div data-ef="hint-items-grid" style={viewportStyle}>
            {hints.map((hint, index) => (
              <HintItem key={`${hint.text}-${index}`} hint={hint} index={index} />
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
              {renderedHints.map((hint, index) => (
                <HintItem key={`${hint.text}-${index}-${virtualOffsetTop}`} hint={hint} index={index} />
              ))}
            </div>
          </div>
        )}
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" className={styles.scrollbar}>
        <ScrollArea.Thumb className={styles.scrollThumb} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
