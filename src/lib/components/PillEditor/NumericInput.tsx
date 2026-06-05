import type { KeyboardEvent } from "react";
import { NumberField } from "@base-ui/react/number-field";
import styles from "./PillEditor.module.less";

/** Numeric spinner built on Base UI's NumberField, used in ValueEditor and RangeEditor. */
export function NumericInput(props: {
  value: string;
  onChange: (v: string) => void;
  step?: number | "any";
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoFocus?: boolean;
}): JSX.Element {
  const { value, onChange, step = 1, className, onKeyDown, placeholder, autoFocus } = props;
  return (
    <NumberField.Root
      value={value === "" ? null : Number(value)}
      onValueChange={(v) => onChange(v == null ? "" : String(v))}
      step={step}
      format={{ useGrouping: false }}
    >
      <NumberField.Group className={styles.numGroup}>
        <NumberField.Decrement className={styles.numBtn}>−</NumberField.Decrement>
        <NumberField.Input
          data-slot="input"
          className={className}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        <NumberField.Increment className={styles.numBtn}>+</NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}
