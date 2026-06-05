import { useUiSelector } from "../../context";
import type { FieldMatch } from "../../types";
import { GhostButton } from "../ui/GhostButton";
import { cx, preventDefaultMouseDown } from "../ui/utils";
import { useScrollIntoViewWhenActive } from "../ui/useScrollIntoViewWhenActive";
import { formatFieldValueForDisplay } from "../../parser";
import styles from "./MatchDropdown.module.less";

export function MatchDropdownRow(props: {
  match: FieldMatch;
  index: number;
  onPick: (match: FieldMatch) => void;
}): JSX.Element {
  const { match, index, onPick } = props;

  const isActive = useUiSelector((s) => s.highlightIndex === index);
  const ref = useScrollIntoViewWhenActive<HTMLButtonElement>(isActive);

  function handleClick(): void {
    onPick(match);
  }

  const defaultText = (() => {
    if (match.type === "value-candidate") {
      return `= ${formatFieldValueForDisplay(match.field, match.text)}`;
    }
    if (match.type === "hint" && match.hint) {
      if (match.hint.kind === "single") {
        if (match.field.type === "date" || match.field.type === "datetime") {
          return formatFieldValueForDisplay(match.field, match.hint.value);
        }
        return match.hint.text;
      }
      if (match.hint.kind === "list") {
        return `${String(match.hint.operator)} (${match.hint.values.map((v) => formatFieldValueForDisplay(match.field, v)).join(", ")})`;
      }
      return `${formatFieldValueForDisplay(match.field, match.hint.from)} to ${formatFieldValueForDisplay(match.field, match.hint.to)}`;
    }
    if (match.type === "set-value") {
      return formatFieldValueForDisplay(match.field, match.setValue ?? match.text);
    }
    return match.text;
  })();
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
      className={cx(styles.row, isActive && styles.active)}
      onMouseDown={preventDefaultMouseDown}
      onClick={handleClick}
    >
      <span className={styles.text}>
        {renderedText ?? defaultText}
      </span>
      <span className={styles.field}>{match.field.label ?? match.field.name}</span>
    </GhostButton>
  );
}

