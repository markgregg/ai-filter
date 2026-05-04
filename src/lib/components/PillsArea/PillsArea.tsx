import {
  Fragment,
  type KeyboardEvent,
  type RefObject,
  useMemo,
  useRef,
} from "react";
import { useDataSelector, useUiSelector } from "../../context";
import { FilterPill } from "../FilterPill/FilterPill";
import { InsertZone } from "./InsertZone";
import { PillsAreaContext } from "./PillsAreaContext";
import styles from "./PillsArea.module.css";

export function PillsArea(props: {
  pillsAreaRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onMoveInputToSlot: (slot: number) => void;
  onFocusRoot: () => void;
}): JSX.Element {
  const pills = useDataSelector((s) => s.pills);
  const isExpanded = useUiSelector((s) => s.focused);

  const dragFromRef = useRef<number | null>(null);

  const areaClass = [styles.area, isExpanded ? styles.expanded : ""].filter(Boolean).join(" ");

  const pillsAreaContextValue = useMemo(
    () => ({
      onFocusRoot: props.onFocusRoot,
      onMoveInputToSlot: props.onMoveInputToSlot,
      inputRef: props.inputRef,
      onInputKeyDown: props.onInputKeyDown,
    }),
    [props.onFocusRoot, props.onMoveInputToSlot, props.inputRef, props.onInputKeyDown],
  );

  return (
    <PillsAreaContext.Provider value={pillsAreaContextValue}>
      <div ref={props.pillsAreaRef} className={areaClass}>
        <InsertZone slot={0} dragFromRef={dragFromRef} />
        {pills.map((pill, index) => (
          <Fragment key={pill.id}>
            <FilterPill pill={pill} index={index} dragFromRef={dragFromRef} />
            <InsertZone slot={index + 1} dragFromRef={dragFromRef} />
          </Fragment>
        ))}
      </div>
    </PillsAreaContext.Provider>
  );
}
