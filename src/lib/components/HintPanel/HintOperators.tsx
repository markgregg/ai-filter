import type { MouseEvent } from "react";
import { GhostButton } from "../ui/GhostButton";
import { Separator } from "@base-ui/react/separator";
import { useHintPanelSelector } from "./HintPanelContext";
import styles from "./HintPanel.module.css";

const LOGICAL_TOKENS = ["AND", "OR", "(", ")"] as const;
type LogicalToken = (typeof LOGICAL_TOKENS)[number];

function LogicalButton({ token }: { token: LogicalToken }): JSX.Element {
  const onInsertLogical = useHintPanelSelector((s) => s.onInsertLogical);

  function handleClick(): void {
    onInsertLogical(token);
  }

  function handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
  }

  return (
    <GhostButton
      type="button"
      className={`${styles.opBtn} ${styles.logicalBtn}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {token}
    </GhostButton>
  );
}

function OperatorButton({ op }: { op: string }): JSX.Element {
  const currentField = useHintPanelSelector((s) => s.currentField);
  const activeOperator = useHintPanelSelector((s) => s.activeOperator);
  const onPickOperator = useHintPanelSelector((s) => s.onPickOperator);

  function handleClick(): void {
    onPickOperator(currentField, op);
  }

  function handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
  }

  return (
    <GhostButton
      type="button"
      className={`${styles.opBtn}${activeOperator === op ? ` ${styles.active}` : ""}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {op}
    </GhostButton>
  );
}

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
