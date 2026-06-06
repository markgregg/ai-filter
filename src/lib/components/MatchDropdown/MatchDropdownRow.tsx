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
      const preview = match.hint.kind === "computed" ? match.hint.preview : match.hint;
      if (!preview) {
        return match.hint.text;
      }
      if (preview.kind === "single") {
        if (match.field.type === "date" || match.field.type === "datetime") {
          return formatFieldValueForDisplay(match.field, preview.value);
        }
        return match.hint.text;
      }
      if (preview.kind === "list") {
        if (match.field.type === "tree") {
          return match.hint.text;
        }
        return `${String(preview.operator)} (${preview.values.map((v) => formatFieldValueForDisplay(match.field, v)).join(", ")})`;
      }
      return `${formatFieldValueForDisplay(match.field, preview.from)} to ${formatFieldValueForDisplay(match.field, preview.to)}`;
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
          : match.hint?.kind === "computed" && match.hint.preview?.kind === "single"
            ? match.hint.preview.value
          : undefined;
  const suggestionValues =
    match.hint?.kind === "list"
      ? match.hint.values
      : match.hint?.kind === "computed" && match.hint.preview?.kind === "list"
        ? match.hint.preview.values
        : undefined;
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

