import type { ClipboardEvent, KeyboardEvent, RefObject } from "react";
import { createSelectorContext } from "../../createSelectorContext";

type PillsAreaCtx = {
  onFocusRoot: () => void;
  onMoveInputToSlot: (slot: number) => void;
  inputRef: RefObject<HTMLInputElement>;
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onInputPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
};

export const [PillsAreaContext, usePillsAreaSelector] =
  createSelectorContext<PillsAreaCtx>("PillsArea");
