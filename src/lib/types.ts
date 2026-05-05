import type { ReactNode } from "react";

export type FieldType =
  | "string"
  | "integer"
  | "float"
  | "boolean"
  | "date"
  | "datetime"
  | "set"
  | "custom";

export type StringOperator = "=" | "!" | "*" | "!*" | "<*" | ">*";
export type CompareOperator = "=" | "!" | ">" | "<" | ">=" | "<=";
export type BooleanOperator = "=" | "!";
export type SetOperator = "=" | "!" | "in";

export type BuiltInOperator =
  | StringOperator
  | CompareOperator
  | BooleanOperator
  | SetOperator;

export type AnyOperator = BuiltInOperator | (string & {});

export type Translator = (text: string) => unknown;

export type SetValuesSource =
  | string[]
  | ((lookupText: string, signal?: AbortSignal) => Promise<string[]>)
  | ((lookupText: string) => Promise<string[]>)
  | (() => Promise<string[]>);

export type AgGridCellDataType =
  | "text"
  | "number"
  | "bigint"
  | "boolean"
  | "date"
  | "dateString"
  | "dateTime"
  | "dateTimeString"
  | "object"
  | false
  | (string & {});

export type AgGridFilterKind = string | boolean;

export type AgGridFilterParams = {
  values?: unknown;
};

export type AgGridColumnDefinition = {
  field?: string;
  headerName?: string;
  cellDataType?: AgGridCellDataType;
  filter?: AgGridFilterKind;
  filterParams?: AgGridFilterParams;
};

export type AgGridColumn = {
  getColDef?: () => AgGridColumnDefinition;
  colDef?: AgGridColumnDefinition;
};

export type AgGridRowNode = {
  data?: Record<string, unknown> | null;
};

export type AgGridApi = {
  getColumns?: () => AgGridColumn[] | null;
  getAllGridColumns?: () => AgGridColumn[] | null;
  forEachNode?: (callback: (node: AgGridRowNode) => void) => void;
  setGridOption?: (key: string, value: unknown) => void;
  onFilterChanged?: () => void;
};

export type HintSingle = {
  kind: "single";
  text: string;
  operator: AnyOperator;
  value: unknown;
};

export type HintList = {
  kind: "list";
  text: string;
  operator: AnyOperator;
  values: unknown[];
};

export type HintRange = {
  kind: "range";
  text: string;
  operator?: never;
  from: unknown;
  to: unknown;
};

export type Hint = HintSingle | HintList | HintRange;

export type HintSource =
  | Hint[]
  | ((signal?: AbortSignal) => Promise<Hint[]>)
  | (() => Promise<Hint[]>)
  | "fieldValues";

export type MatchRankingConfig = {
  /** Enable behavioral ranking. Defaults to `true` when config is provided. */
  enabled?: boolean;
  /** Weight for field precedence contribution. */
  precedenceWeight?: number;
  /** Weight for usage-history contribution (how often a field/value was used recently). */
  usageWeight?: number;
  /** Weight for recency contribution (how recently the same value was used). */
  recencyWeight?: number;
  /** Weight for exactness contribution (exact/prefix/contains match quality). */
  exactnessWeight?: number;
};

export type CustomEditorProps = {
  value: string;
  onChange: (next: string) => void;
  onCommit: () => void;
  onCancel: () => void;
};

export type FieldRendererInput = {
  /** Fallback text produced by AiFilter when no custom renderer is provided. */
  defaultText: string;
  /** Single value associated with the UI item (value pill / single hint / value suggestion). */
  value?: unknown;
  /** Multiple values associated with the UI item (list pill / list hint). */
  values?: unknown[];
  /** Hint payload when rendering a hint row. */
  hint?: Hint;
  /** Match payload when rendering a suggestion row. */
  suggestion?: FieldMatch;
  /** Pill payload when rendering pill text. */
  pill?: ValuePill | ListPill | RangePill;
};

export type FieldRenderers = {
  /** Override rendering for hint rows in the hint panel for this field. */
  hint?: (input: FieldRendererInput) => ReactNode;
  /** Override rendering for match/suggestion rows in the match dropdown for this field. */
  match?: (input: FieldRendererInput) => ReactNode;
  /** Override rendering for the text content inside pills for this field. */
  pill?: (input: FieldRendererInput) => ReactNode;
};

type BaseFieldDefinition = {
  name: string;
  label?: string;
  precedence: number;
  /** Controls the position of this field in the hint panel field list. Lower numbers appear first. Fields without this property are sorted after those that have it, preserving their original order. */
  hintOrder?: number;
  maxInstances?: number;
  hints?: HintSource;
  hintsDebounceMs?: number;
  editor?: (props: CustomEditorProps) => ReactNode;
  renderers?: FieldRenderers;
};

type CustomFieldDefinition = BaseFieldDefinition & {
  type: "custom";
  translate: Translator;
  operators: AnyOperator[];
  setValues?: never;
};

type SetFieldDefinition = BaseFieldDefinition & {
  type: "set";
  setValues?: SetValuesSource;
  setValuesDebounceMs?: number;
  translate?: never;
  operators?: AnyOperator[];
};

type StandardFieldDefinition = BaseFieldDefinition & {
  type: "string" | "integer" | "float" | "boolean" | "date" | "datetime";
  translate?: Translator;
  operators?: AnyOperator[];
  setValues?: never;
  /** Custom display/input format. For date: default "yyyy-MM-dd". For datetime: default "yyyy-MM-dd HH:mm:ss". */
  dateFormat?: string;
};

export type FieldDefinition =
  | CustomFieldDefinition
  | SetFieldDefinition
  | StandardFieldDefinition;

export type LogicalToken = "AND" | "OR" | "(" | ")";

export type AndPill = { id: string; kind: "and"; invalid?: boolean };
export type OrPill = { id: string; kind: "or"; invalid?: boolean };
export type OpenBracketPill = { id: string; kind: "open-bracket"; invalid?: boolean };
export type CloseBracketPill = { id: string; kind: "close-bracket"; invalid?: boolean };

export type ValuePill = {
  id: string;
  kind: "value";
  fieldName: string;
  operator: AnyOperator;
  value: unknown;
  invalid?: boolean;
};

export type ListPill = {
  id: string;
  kind: "list";
  fieldName: string;
  operator: AnyOperator;
  values: unknown[];
  invalid?: boolean;
};

export type RangePill = {
  id: string;
  kind: "range";
  fieldName: string;
  from: unknown;
  to: unknown;
  invalid?: boolean;
};

export type FilterPill =
  | AndPill
  | OrPill
  | OpenBracketPill
  | CloseBracketPill
  | ValuePill
  | ListPill
  | RangePill;

export type AgGridExternalFilter = {
  isExternalFilterPresent: () => boolean;
  doesExternalFilterPass: (row: AgGridRowNode | Record<string, unknown> | null | undefined) => boolean;
};

export type FilterChangeEvent = {
  pills: FilterPill[];
  filter: AgGridExternalFilter;
};

export type FieldMatch = {
  type: "field" | "set-value" | "hint" | "value-candidate";
  field: FieldDefinition;
  text: string;
  rank: number;
  hint?: Hint;
  setValue?: string;
  /** The operator that was explicitly typed in the input when this match was generated. */
  operator?: AnyOperator;
};

export type AiConfig = {
  /**
   * Function that receives a structured prompt and returns the model's raw text response.
   * Typically a fetch wrapper calling an AI inference endpoint.
   */
  resolve: (prompt: string) => Promise<string>;
};

export type AiFilterProps = {
  id?: string;
  fields?: FieldDefinition[];
  /** Optional AG Grid API. When provided, fields are built from AG Grid column definitions. */
  agGrid?: AgGridApi;
  pills?: FilterPill[];
  onChange?: (pills: FilterPill[]) => void;
  /** Fired after AG Grid external filter callbacks are rebuilt from the latest pill expression. */
  onFilterChange?: (event: FilterChangeEvent) => void;
  onClear?: () => void;
  hintsEnabled?: boolean;
  className?: string;
  placeholder?: string;
  /** Placeholder text for the AI / natural-language input box. Defaults to "Describe your filter in plain English…". */
  aiPlaceholder?: string;
  /** AI natural-language filter input. Pass an `AiConfig` with a `resolve` function to enable. */
  ai?: AiConfig | false;
  /**
   * Colour scheme for the filter widget.
   * - `"auto"` (default) – follows the OS / system preference via `prefers-color-scheme`.
   * - `"light"` – always light.
   * - `"dark"`  – always dark.
   */
  colorScheme?: "light" | "dark" | "auto";
  /**
   * Maximum height of the match/suggestion dropdown (e.g. `"12rem"`, `"300px"`).
   * Defaults to `"12rem"`.
   */
  matchDropdownMaxHeight?: string;
  /**
   * Makes the match/suggestion dropdown sticky while scrolling within its container.
   * Defaults to `false`.
   */
  suggestionsDropdownSticky?: boolean;
  /**
   * Maximum height of the hint panel body (fields + hints area).
   * Defaults to `"15rem"`.
   */
  hintPanelMaxHeight?: string;
  /**
   * Number of columns for the hints list inside the hint panel.
   * When > 1 hints wrap into adjacent columns before scrolling.
   * Defaults to `1`.
   */
  hintColumns?: number;
  /**
   * Optional behavioral ranking for suggestions.
   * When enabled, suggestions are ranked using usage history + precedence + recency + exactness.
   */
  matchRanking?: MatchRankingConfig | false;
  /**
   * Enable virtualized hint rendering for large hint sets.
   * Defaults to `false`.
   */
  hintVirtualized?: boolean;
  /**
   * When true, shows a search text box at the top of the hint panel field list.
   * Typing into it filters the visible fields by name or label (case-insensitive).
   * Defaults to `false`.
   */
  hintFieldSearch?: boolean;
  /**
   * Maximum width for each rendered pill (e.g. `"14rem"`, `"220px"`).
   * When set, long pill text is truncated with an ellipsis.
   */
  pillMaxWidth?: string;
};
