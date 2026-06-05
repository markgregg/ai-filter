import type { Dispatch, SetStateAction } from "react";
import { createSelectorContext } from "../../createSelectorContext";
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
  onLookupChange?: (text: string) => void;
  onCommit: (pill: ValuePill | ListPill | RangePill) => void;
  onCancel: () => void;
};

export const [PillEditorContext, usePillEditorSelector] =
  createSelectorContext<PillEditorCtx>("PillEditor");
