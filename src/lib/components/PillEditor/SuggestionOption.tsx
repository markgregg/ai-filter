import { memo } from "react";
import { GhostButton } from "../ui/GhostButton";
import { cx, preventDefaultMouseDown } from "../ui/utils";
import styles from "./PillEditor.module.less";

export const SuggestionOption = memo(function SuggestionOption(props: {
  option: string;
  isActive: boolean;
  onSelect: () => void;
}): JSX.Element {
  const { option, isActive, onSelect } = props;

  return (
    <GhostButton
      type="button"
      className={cx(styles.suggestion, isActive && styles.active)}
      onMouseDown={preventDefaultMouseDown}
      onClick={onSelect}
    >
      {option}
    </GhostButton>
  );
});
