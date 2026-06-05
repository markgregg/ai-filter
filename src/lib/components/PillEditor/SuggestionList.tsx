import { memo, useCallback } from "react";
import { usePillEditorSelector } from "./PillEditorContext";
import type { ListPill, RangePill, ValuePill } from "../../types";
import { SuggestionOption } from "./SuggestionOption";
import styles from "./PillEditor.module.less";

function commitSuggestionOption(args: {
  option: string;
  index: number;
  suggestionIndex: number;
  setLocal: (next: string) => void;
  onCommit: (pill: ValuePill | ListPill | RangePill) => void;
  pill: ValuePill | ListPill | RangePill;
}): void {
  const { option, index, suggestionIndex, setLocal, onCommit, pill } = args;
  if (index !== suggestionIndex) return;
  setLocal(option);
  if (pill.kind === "value") {
    onCommit({ ...pill, value: option });
  } else if (pill.kind === "list") {
    onCommit({ ...pill, values: [option] });
  }
}

const SuggestionOptionRow = memo(function SuggestionOptionRow(props: { option: string; index: number }): JSX.Element {
  const { option, index } = props;

  const pill = usePillEditorSelector((s) => s.pill);
  const setLocal = usePillEditorSelector((s) => s.setLocal);
  const onCommit = usePillEditorSelector((s) => s.onCommit);
  const suggestionIndex = usePillEditorSelector((s) => s.suggestionIndex);
  const isActive = suggestionIndex === index;

  const handleClick = useCallback((): void => {
    commitSuggestionOption({
      option,
      index,
      suggestionIndex,
      setLocal,
      onCommit,
      pill,
    });
  }, [index, onCommit, option, pill, setLocal, suggestionIndex]);

  return (
    <SuggestionOption option={option} isActive={isActive} onSelect={handleClick} />
  );
});

export function SuggestionList({ inPortal = false }: { inPortal?: boolean }): JSX.Element | null {
  const field = usePillEditorSelector((s) => s.field);
  const filteredOptions = usePillEditorSelector((s) => s.filteredOptions);

  if (field.type !== "set") return null;

  const cls = inPortal ? styles.suggestionsDropdown : styles.suggestions;

  return (
    <div className={cls} role="listbox" aria-label="Value suggestions">
      {filteredOptions.length ? (
        filteredOptions.map((option, index) => (
          <SuggestionOptionRow key={option} option={option} index={index} />
        ))
      ) : (
        <div className={styles.noOptions}>No valid options</div>
      )}
    </div>
  );
}
