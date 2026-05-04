import type { KeyboardEvent, RefObject } from "react";
import { createContext, useContextSelector } from "use-context-selector";

type PillsAreaCtx = {
  onFocusRoot: () => void;
  onMoveInputToSlot: (slot: number) => void;
  inputRef: RefObject<HTMLInputElement>;
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
};

export const PillsAreaContext = createContext<PillsAreaCtx | null>(null);

export function usePillsAreaSelector<T>(selector: (ctx: PillsAreaCtx) => T): T {
  return useContextSelector(PillsAreaContext, (value) => {
    if (!value) throw new Error("usePillsAreaSelector must be used inside PillsArea");
    return selector(value);
  });
}
