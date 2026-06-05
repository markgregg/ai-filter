import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from "react";
import { EfInput } from "../ui/EfInput";
import { usePillEditorSelector } from "./PillEditorContext";
import { SuggestionList } from "./SuggestionList";
import { PortalDropdown } from "./PortalDropdown";
import { NumericInput } from "./NumericInput";
import styles from "./PillEditor.module.less";

export function ValueEditor(): JSX.Element {
  const field = usePillEditorSelector((s) => s.field);
  const local = usePillEditorSelector((s) => s.local);
  const setLocal = usePillEditorSelector((s) => s.setLocal);
  const filteredOptions = usePillEditorSelector((s) => s.filteredOptions);
  const suggestionIndex = usePillEditorSelector((s) => s.suggestionIndex);
  const setSuggestionIndex = usePillEditorSelector((s) => s.setSuggestionIndex);
  const inputType = usePillEditorSelector((s) => s.inputType);
  const isError = usePillEditorSelector((s) => s.isError);
  const pill = usePillEditorSelector((s) => s.pill);
  const onCommit = usePillEditorSelector((s) => s.onCommit);
  const save = usePillEditorSelector((s) => s.save);
  const onCancel = usePillEditorSelector((s) => s.onCancel);
  const onLookupChange = usePillEditorSelector((s) => s.onLookupChange);

  const usesHintFiltering =
    field.type === "set" && (pill.kind === "value" || pill.kind === "list");
  const supportsSuggestions = field.type === "set" && !usesHintFiltering;
  const isNumeric = field.type === "integer" || field.type === "float";
  const editorClass = `${styles.editor}${isError ? ` ${styles.editorError}` : ""}`;
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (field.type !== "set") return;
    onLookupChange?.(local);
  // onLookupChange is intentionally excluded — callers may pass inline lambdas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.type, local]);

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    setLocal(e.target.value);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (supportsSuggestions && filteredOptions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIndex((prev) => Math.min(filteredOptions.length - 1, prev + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const picked = filteredOptions[suggestionIndex];
        if (picked) {
          setLocal(picked);
          if (pill.kind === "value") {
            onCommit({ ...pill, value: picked });
          } else if (pill.kind === "list") {
            onCommit({ ...pill, values: [picked] });
          }
        }
        return;
      }
    }
    if (e.key === "Enter") save();
    if (e.key === "Escape") onCancel();
  }

  if (isNumeric) {
    return (
      <NumericInput
        value={local}
        onChange={setLocal}
        step={field.type === "float" ? "any" : 1}
        className={editorClass}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    );
  }

  return (
    <>
      <div ref={anchorRef} style={{ display: "inline-flex", alignItems: "center" }}>
        <EfInput
          className={editorClass}
          type={inputType}
          value={local}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
      {supportsSuggestions && (
        <PortalDropdown anchorRef={anchorRef}>
          <SuggestionList inPortal />
        </PortalDropdown>
      )}
    </>
  );
}
