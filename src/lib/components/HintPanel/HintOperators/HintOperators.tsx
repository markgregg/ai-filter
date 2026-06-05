import { Separator } from "@base-ui/react/separator";
import { useHintPanelSelector } from "../HintPanelContext";
import { LOGICAL_TOKENS, LogicalButton } from "./LogicalButton";
import { OperatorButton } from "./OperatorButton";
import styles from "../HintPanel.module.less";

export function HintOperators(): JSX.Element {
  const operators = useHintPanelSelector((s) => s.operators);

  return (
    <div className={styles.ops}>
      {LOGICAL_TOKENS.map((token) => (
        <LogicalButton key={token} token={token} />
      ))}
      <Separator data-slot="separator" orientation="vertical" className={styles.opSepEl} />
      {operators.map((op) => (
        <OperatorButton key={String(op)} op={String(op)} />
      ))}
    </div>
  );
}

