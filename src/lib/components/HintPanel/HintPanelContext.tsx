import { createSelectorContext } from "../../createSelectorContext";
import type { AnyOperator, FieldDefinition, Hint } from "../../types";

export type HintPanelCtx = {
  currentField: FieldDefinition;
  operators: AnyOperator[];
  hints: Hint[];
  hintEntries: Array<{ field: FieldDefinition; hint: Hint }>;
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
  favoritesFieldName: string;
  showFavoritesField: boolean;
  isFavoritesSelected: boolean;
  toggleSelectedField: (name: string) => void;
  selectField: (name: string) => void;
  selectFavorites: () => void;
  onPickHint: (field: FieldDefinition, hint: Hint, isSelected: boolean) => void;
  onPickOperator: (field: FieldDefinition, operator: AnyOperator) => void;
  onInsertField: (field: FieldDefinition) => void;
  onInsertLogical: (token: string) => void;
};

const FALLBACK_FIELD: FieldDefinition = {
  name: "__fallback__",
  label: "Fallback",
  type: "string",
  precedence: 0,
};

const DEFAULT_HINT_PANEL_CTX: HintPanelCtx = {
  currentField: FALLBACK_FIELD,
  operators: [],
  hints: [],
  hintEntries: [],
  activeOperator: undefined,
  selectedValues: new Set<string>(),
  hasPillSelected: false,
  fixedField: undefined,
  effectiveFieldName: undefined,
  inputField: undefined,
  aiMode: false,
  onAiAppendText: () => undefined,
  hintColumns: 1,
  hintVirtualized: false,
  fieldColumns: 1,
  favoritesFieldName: "__favorites__",
  showFavoritesField: false,
  isFavoritesSelected: false,
  toggleSelectedField: () => undefined,
  selectField: () => undefined,
  selectFavorites: () => undefined,
  onPickHint: () => undefined,
  onPickOperator: () => undefined,
  onInsertField: () => undefined,
  onInsertLogical: () => undefined,
};

export const [HintPanelContext, useHintPanelSelector] =
  createSelectorContext<HintPanelCtx>("HintPanel", DEFAULT_HINT_PANEL_CTX);
