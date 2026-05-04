import type { Dispatch, SetStateAction } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import type { FieldDefinition, ListPill, RangePill, ValuePill } from "../../types";

export type PillEditorCtx = {
  pill: ValuePill | ListPill | RangePill;
  field: FieldDefinition;
  options: string[];
  local: string;
  setLocal: Dispatch<SetStateAction<string>>;
  localTo: string;
  setLocalTo: Dispatch<SetStateAction<string>>;
  filteredOptions: string[];
  suggestionIndex: number;
  setSuggestionIndex: Dispatch<SetStateAction<number>>;
  inputType: "text" | "number" | "date" | "datetime-local";
  isError: boolean;
  save: () => void;
  saveRange: () => void;
  onCommit: (pill: ValuePill | ListPill | RangePill) => void;
  onCancel: () => void;
};

export const PillEditorContext = createContext<PillEditorCtx | null>(null);

export function usePillEditorSelector<T>(selector: (ctx: PillEditorCtx) => T): T {
  return useContextSelector(PillEditorContext, (value) => {
    if (!value) throw new Error("usePillEditorSelector must be used inside PillEditor");
    return selector(value);
  });
}
