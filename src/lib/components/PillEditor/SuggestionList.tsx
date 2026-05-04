import type { MouseEvent } from "react";
import { GhostButton } from "../ui/GhostButton";
import { usePillEditorSelector } from "./PillEditorContext";
import styles from "./PillEditor.module.css";

function SuggestionOption(props: { option: string; index: number }): JSX.Element {
  const { option, index } = props;

  const pill = usePillEditorSelector((s) => s.pill);
  const setLocal = usePillEditorSelector((s) => s.setLocal);
  const onCommit = usePillEditorSelector((s) => s.onCommit);
  const isActive = usePillEditorSelector((s) => s.suggestionIndex === index);

  function handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
  }

  function handleClick(): void {
    setLocal(option);
    if (pill.kind === "value") {
      onCommit({ ...pill, value: option });
    } else if (pill.kind === "list") {
      onCommit({ ...pill, values: [option] });
    }
  }

  return (
    <GhostButton
      type="button"
      className={`${styles.suggestion}${isActive ? ` ${styles.active}` : ""}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {option}
    </GhostButton>
  );
}

export function SuggestionList({ inPortal = false }: { inPortal?: boolean }): JSX.Element | null {
  const field = usePillEditorSelector((s) => s.field);
  const filteredOptions = usePillEditorSelector((s) => s.filteredOptions);

  if (field.type !== "set") return null;

  const cls = inPortal ? styles.suggestionsDropdown : styles.suggestions;

  return (
    <div className={cls} role="listbox" aria-label="Value suggestions">
      {filteredOptions.length ? (
        filteredOptions.map((option, index) => (
          <SuggestionOption key={option} option={option} index={index} />
        ))
      ) : (
        <div className={styles.noOptions}>No valid options</div>
      )}
    </div>
  );
}
