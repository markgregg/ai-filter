import { createContext, useContextSelector } from "use-context-selector";
import type { AnyOperator, FieldDefinition, Hint } from "../../types";

export type HintPanelCtx = {
  currentField: FieldDefinition;
  operators: AnyOperator[];
  hints: Hint[];
  activeOperator: AnyOperator | undefined;
  selectedValues: Set<string>;
  hasPillSelected: boolean;
  fixedField: string | undefined;
  effectiveFieldName: string | undefined;
  inputField: FieldDefinition | undefined;
  /** True when the filter is in AI natural-language input mode. */
  aiMode: boolean;
  /** Append plain text to the AI query input (only called when aiMode is true). */
  onAiAppendText: (text: string) => void;
  /** Number of columns for the hints list. */
  hintColumns: number;
  /** Enable virtualized rendering for large hint lists. */
  hintVirtualized: boolean;
  /** Number of columns for the fields list. */
  fieldColumns: number;
  toggleSelectedField: (name: string) => void;
  selectField: (name: string) => void;
  onPickHint: (field: FieldDefinition, hint: Hint, isSelected: boolean) => void;
  onPickOperator: (field: FieldDefinition, operator: AnyOperator) => void;
  onInsertField: (field: FieldDefinition) => void;
  onInsertLogical: (token: string) => void;
};

export const HintPanelContext = createContext<HintPanelCtx | null>(null);

export function useHintPanelSelector<T>(selector: (ctx: HintPanelCtx) => T): T {
  return useContextSelector(HintPanelContext, (value) => {
    if (!value) throw new Error("useHintPanelSelector must be used inside HintPanel");
    return selector(value);
  });
}
