import type { ChangeEvent } from "react";
import { EfInput } from "../ui/EfInput";
import { useConfigSelector, useUiSelector } from "../../context";
import { usePillsAreaSelector } from "./PillsAreaContext";
import styles from "./PillsArea.module.css";

export function FilterInput(): JSX.Element {
  const inputRef = usePillsAreaSelector((s) => s.inputRef);
  const onInputKeyDown = usePillsAreaSelector((s) => s.onInputKeyDown);

  const inputValue = useUiSelector((s) => s.inputValue);
  const setInputValue = useUiSelector((s) => s.setInputValue);
  const isExpanded = useUiSelector((s) => s.focused);

  const placeholder = useConfigSelector((s) => s.placeholder);

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    setInputValue(e.target.value);
  }

  return (
    <EfInput
      ref={inputRef}
      className={styles.input}
      value={inputValue}
      onChange={handleChange}
      onKeyDown={onInputKeyDown}
      placeholder={placeholder ?? "Type a filter..."}
      autoFocus={isExpanded}
    />
  );
}
