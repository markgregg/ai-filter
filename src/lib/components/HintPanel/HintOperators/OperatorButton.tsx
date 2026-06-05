import { GhostButton } from "../../ui/GhostButton";
import { useHintPanelSelector } from "../HintPanelContext";
import { cx, preventDefaultMouseDown } from "../../ui/utils";
import styles from "../HintPanel.module.less";

export function OperatorButton({ op }: { op: string }): JSX.Element {
  const currentField = useHintPanelSelector((s) => s.currentField);
  const activeOperator = useHintPanelSelector((s) => s.activeOperator);
  const onPickOperator = useHintPanelSelector((s) => s.onPickOperator);

  function handleClick(): void {
    onPickOperator(currentField, op);
  }

  return (
    <GhostButton
      type="button"
      className={cx(styles.opBtn, activeOperator === op && styles.active)}
      onMouseDown={preventDefaultMouseDown}
      onClick={handleClick}
    >
      {op}
    </GhostButton>
  );
}

