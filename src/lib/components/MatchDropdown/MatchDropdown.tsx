import type { FieldMatch } from "../../types";
import { MatchDropdownRow } from "./MatchDropdownRow";
import styles from "./MatchDropdown.module.css";

export function MatchDropdown(props: {
  matches: FieldMatch[];
  onPick: (match: FieldMatch) => void;
  maxHeight?: string;
  forceVisible?: boolean;
}): JSX.Element | null {
  if (!props.matches.length && !props.forceVisible) return null;

  const style = props.maxHeight ? { maxHeight: props.maxHeight } : undefined;

  return (
    <div
      className={styles.dropdown}
      role="listbox"
      aria-label="Matches"
      style={style}
    >
      {props.matches.map((match, index) => (
        <MatchDropdownRow
          key={`${match.field.name}-${match.type}-${match.text}-${index}`}
          match={match}
          index={index}
          onPick={props.onPick}
        />
      ))}
    </div>
  );
}
