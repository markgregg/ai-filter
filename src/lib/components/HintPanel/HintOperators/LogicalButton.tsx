import { GhostButton } from "../../ui/GhostButton";
import { useHintPanelSelector } from "../HintPanelContext";
import { cx, preventDefaultMouseDown } from "../../ui/utils";
import styles from "../HintPanel.module.less";

export const LOGICAL_TOKENS = ["AND", "OR", "(", ")"] as const;
export type LogicalToken = (typeof LOGICAL_TOKENS)[number];

export function LogicalButton({ token }: { token: LogicalToken }): JSX.Element {
  const onInsertLogical = useHintPanelSelector((s) => s.onInsertLogical);

  function handleClick(): void {
    onInsertLogical(token);
  }

  return (
    <GhostButton
      type="button"
      className={cx(styles.opBtn, styles.logicalBtn)}
      onMouseDown={preventDefaultMouseDown}
      onClick={handleClick}
    >
      {token}
    </GhostButton>
  );
}

