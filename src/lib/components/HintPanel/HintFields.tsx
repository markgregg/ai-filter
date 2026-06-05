import { useCallback, useState } from "react";
import { GhostButton } from "../ui/GhostButton";
import { useConfigSelector, useDataSelector, useUiSelector } from "../../context";
import type { FieldDefinition } from "../../types";
import { useHintPanelSelector } from "./HintPanelContext";
import { EfScrollArea } from "./EfScrollArea";
import { cx, preventDefaultMouseDown } from "../ui/utils";
import { useScrollIntoViewWhenActive } from "../ui/useScrollIntoViewWhenActive";
import { useFilteredHintFields } from "./useFilteredHintFields";
import styles from "./HintPanel.module.less";

function FieldRow({ field }: { field: FieldDefinition }): JSX.Element {
  const hasPillSelected = useHintPanelSelector((s) => s.hasPillSelected);
  const fixedField = useHintPanelSelector((s) => s.fixedField);
  const effectiveFieldName = useHintPanelSelector((s) => s.effectiveFieldName);
  const inputField = useHintPanelSelector((s) => s.inputField);
  const toggleSelectedField = useHintPanelSelector((s) => s.toggleSelectedField);
  const selectField = useHintPanelSelector((s) => s.selectField);
  const onInsertField = useHintPanelSelector((s) => s.onInsertField);
  const aiMode = useHintPanelSelector((s) => s.aiMode);
  const pills = useDataSelector((s) => s.pills);
  const setSelectedIds = useUiSelector((s) => s.setSelectedIds);
  const setEditingId = useUiSelector((s) => s.setEditingId);
  const setInsertIndex = useUiSelector((s) => s.setInsertIndex);
  const setActiveField = useUiSelector((s) => s.setActiveField);
  const setFocused = useUiSelector((s) => s.setFocused);

  const fieldPillCount = useDataSelector(
    (s) => s.pills.filter((p) => "fieldName" in p && p.fieldName === field.name).length,
  );
  const atMax =
    !aiMode && field.maxInstances !== undefined && fieldPillCount >= field.maxInstances;

  const isLockedByPill = !aiMode && hasPillSelected && fixedField !== field.name;
  const isLockedByInput = !aiMode && Boolean(inputField) && inputField?.name !== field.name;
  const isLocked = isLockedByPill || isLockedByInput;
  const isDisabled = isLockedByInput || atMax;
  const isSelected = effectiveFieldName === field.name;

  const ref = useScrollIntoViewWhenActive<HTMLButtonElement>(isSelected);

  function handleSelect(): void {
    if (isLockedByPill) {
      setSelectedIds([]);
      setEditingId(undefined);
      selectField(field.name);
      setActiveField(field.name);
      setInsertIndex(pills.length);
      setFocused(true);
      return;
    }
    if (!isLocked) toggleSelectedField(field.name);
  }

  function handleInsert(): void {
    selectField(field.name);
    onInsertField(field);
  }

  return (
    <div className={styles.fieldRow}>
      <GhostButton
        ref={ref}
        type="button"
        className={cx(styles.fieldOption, isSelected && styles.active)}
        onClick={handleSelect}
        disabled={isDisabled}
      >
        {field.label ?? field.name}
      </GhostButton>
      {!aiMode && (
        <GhostButton
          data-size="icon-sm"
          type="button"
          className={styles.fieldPlus}
          onMouseDown={preventDefaultMouseDown}
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
  const favoritesFieldName = useHintPanelSelector((s) => s.favoritesFieldName);
  const showFavoritesField = useHintPanelSelector((s) => s.showFavoritesField);
  const isFavoritesSelected = useHintPanelSelector((s) => s.isFavoritesSelected);
  const selectFavorites = useHintPanelSelector((s) => s.selectFavorites);
  const setSelectedIds = useUiSelector((s) => s.setSelectedIds);
  const setEditingId = useUiSelector((s) => s.setEditingId);
  const [searchText, setSearchText] = useState("");
  const fields = useFilteredHintFields({ rawFields, hintFieldSearch, searchText });
  const fieldColumns = useHintPanelSelector((s) => s.fieldColumns);

  const handleFieldSearchChange = useCallback((value: string): void => {
    setSearchText(value);
  }, []);

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
            onChange={(e) => handleFieldSearchChange(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <EfScrollArea style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div style={viewportStyle}>
          {showFavoritesField && (
            <div className={styles.fieldRow}>
              <GhostButton
                type="button"
                className={cx(styles.fieldOption, isFavoritesSelected && styles.active)}
                onClick={() => {
                  setSelectedIds([]);
                  setEditingId(undefined);
                  selectFavorites();
                }}
                data-ef={favoritesFieldName}
              >
                Favorites
              </GhostButton>
            </div>
          )}
          {fields.map((field) => (
            <FieldRow key={field.name} field={field} />
          ))}
        </div>
      </EfScrollArea>
    </div>
  );
}

