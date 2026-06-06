import { useEffect, useMemo, useRef, useState } from "react";
import type { Hint, MaterializedHint } from "../../types";
import { useHintPanelSelector } from "./HintPanelContext";
import { EfScrollArea } from "./EfScrollArea";
import { cx, preventDefaultMouseDown } from "../ui/utils";
import { GhostButton } from "../ui/GhostButton";
import { formatFieldValueForDisplay } from "../../parser";
import type { FieldDefinition } from "../../types";
import { collectTreeLeafValues } from "../../tree";
import styles from "./HintPanel.module.less";

function TreeHintItems({ field }: { field: FieldDefinition & { type: "tree" } }): JSX.Element {
  const selectedValues = useHintPanelSelector((s) => s.selectedValues);
  const onPickHint = useHintPanelSelector((s) => s.onPickHint);
  const [hoverPath, setHoverPath] = useState<string[]>([]);
  const selectedValuesLower = useMemo(
    () => new Set([...selectedValues].map((value) => String(value).toLowerCase())),
    [selectedValues],
  );

  const columns = useMemo(() => {
    const result: Array<Array<{ value: string; children?: Array<{ value: string; children?: unknown[] }> }>> = [];
    let currentLevel = field.treeValues;
    let level = 0;
    while (currentLevel.length > 0 && level < 5) {
      result.push(currentLevel as Array<{ value: string; children?: Array<{ value: string; children?: unknown[] }> }>);
      const hovered = hoverPath[level];
      const next = hovered ? currentLevel.find((node) => node.value === hovered)?.children ?? [] : [];
      currentLevel = next;
      level += 1;
    }
    return result;
  }, [field.treeValues, hoverPath]);

  return (
    <div className={styles.treeHintPopup}>
      {columns.map((nodes, levelIndex) => (
        <div key={`tree-level-${levelIndex}`} className={styles.treeHintColumn}>
          {nodes.map((node) => {
            const leafValues = collectTreeLeafValues(node);
            const isParent = Boolean(node.children?.length);
            const selectedLeafCount = leafValues.filter((leaf) =>
              selectedValuesLower.has(String(leaf).toLowerCase()),
            ).length;
            const allSelected = leafValues.length > 0 && selectedLeafCount === leafValues.length;
            const leafSelected = selectedLeafCount > 0;
            const isLeaf = !isParent;
            const isRowActive = isLeaf ? leafSelected : allSelected;

            return (
              <GhostButton
                key={`${levelIndex}-${node.value}`}
                type="button"
                className={cx(styles.hintRow, isRowActive && styles.active, isParent && styles.treeHintParent)}
                onMouseDown={preventDefaultMouseDown}
                onMouseEnter={() => {
                  const nextPath = hoverPath.slice(0, levelIndex);
                  nextPath[levelIndex] = node.value;
                  setHoverPath(nextPath);
                }}
                onClick={() => {
                  if (leafValues.length <= 1) {
                    onPickHint(field, {
                      kind: "single",
                      text: node.value,
                      operator: "=",
                      value: leafValues[0] ?? node.value,
                    }, allSelected);
                    return;
                  }
                  onPickHint(field, {
                    kind: "list",
                    text: node.value,
                    operator: "=",
                    values: leafValues,
                  }, allSelected);
                }}
              >
                <span>{node.value}</span>
                {isParent ? <span className={styles.treeHintChevron}>›</span> : null}
              </GhostButton>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function HintItem({ entry }: { entry: { field: FieldDefinition; hint: Hint } }): JSX.Element {
  const isFavoritesSelected = useHintPanelSelector((s) => s.isFavoritesSelected);
  const selectedValues = useHintPanelSelector((s) => s.selectedValues);
  const onPickHint = useHintPanelSelector((s) => s.onPickHint);

  const hint = entry.hint;
  const fieldForHint = entry.field;
  const previewHint: MaterializedHint | undefined = hint.kind === "computed" ? hint.preview : hint;

  let caption: string;
  let isHintSelected: boolean;

  if (previewHint?.kind === "list") {
    caption = `${String(previewHint.operator)} (${previewHint.values.map((v) => formatFieldValueForDisplay(fieldForHint, v)).join(", ")})`;
    isHintSelected = previewHint.values.some((v) => selectedValues.has(formatFieldValueForDisplay(fieldForHint, v)));
  } else if (previewHint?.kind === "range") {
    caption = `${formatFieldValueForDisplay(fieldForHint, previewHint.from)} to ${formatFieldValueForDisplay(fieldForHint, previewHint.to)}`;
    isHintSelected = selectedValues.has(caption);
  } else if (previewHint?.kind === "single") {
    const isDateField = fieldForHint.type === "date" || fieldForHint.type === "datetime";
    caption = isDateField ? formatFieldValueForDisplay(fieldForHint, previewHint.value) : hint.text;
    isHintSelected = selectedValues.has(caption);
  } else {
    caption = hint.text;
    isHintSelected = false;
  }

  const displayCaption = isFavoritesSelected
    ? `${fieldForHint.label ?? fieldForHint.name}: ${caption}`
    : caption;

  const capturedCaption = displayCaption;
  const capturedIsSelected = isHintSelected;
  const renderedCaption = fieldForHint.renderers?.hint?.({
    defaultText: capturedCaption,
    hint,
    value: previewHint?.kind === "single" ? previewHint.value : undefined,
    values: previewHint?.kind === "list" ? previewHint.values : undefined,
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
  const currentField = useHintPanelSelector((s) => s.currentField);
  const isFavoritesSelected = useHintPanelSelector((s) => s.isFavoritesSelected);
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

  if (currentField.type === "tree" && !isFavoritesSelected) {
    return (
      <EfScrollArea className={styles.values}>
        <TreeHintItems field={currentField} />
      </EfScrollArea>
    );
  }

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

