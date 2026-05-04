import { useEffect, useRef, type MouseEvent } from "react";
import { GhostButton } from "../ui/GhostButton";
import { useUiSelector } from "../../context";
import type { FieldMatch } from "../../types";
import styles from "./MatchDropdown.module.css";

export function MatchDropdownRow(props: {
  match: FieldMatch;
  index: number;
  onPick: (match: FieldMatch) => void;
}): JSX.Element {
  const { match, index, onPick } = props;

  const isActive = useUiSelector((s) => s.highlightIndex === index);
  const ref = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isActive]);

  function handleClick(): void {
    onPick(match);
  }

  function handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
  }

  const defaultText = match.type === "value-candidate" ? `= ${match.text}` : match.text;
  const suggestionValue =
    match.type === "set-value"
      ? (match.setValue ?? match.text)
      : match.type === "value-candidate"
        ? match.text
        : match.hint?.kind === "single"
          ? match.hint.value
          : undefined;
  const suggestionValues = match.hint?.kind === "list" ? match.hint.values : undefined;
  const renderedText = match.field.renderers?.match?.({
    defaultText,
    value: suggestionValue,
    values: suggestionValues,
    hint: match.hint,
    suggestion: match,
  });

  return (
    <GhostButton
      ref={ref}
      type="button"
      className={`${styles.row}${isActive ? ` ${styles.active}` : ""}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <span className={styles.text}>
        {renderedText ?? defaultText}
      </span>
      <span className={styles.field}>{match.field.label ?? match.field.name}</span>
    </GhostButton>
  );
}
