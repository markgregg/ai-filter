import { useCallback, useMemo, useState } from "react";
import type { Story } from "@ladle/react";
import { Switch } from "@base-ui/react/switch";
import { AiFilter, resolveNlpQuery } from "../lib";
import type { AgGridApi, FieldDefinition, FilterPill, Hint, ValueResolver } from "../lib";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type GridReadyEvent } from "ag-grid-community";
import "../styles/global.css";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

ModuleRegistry.registerModules([AllCommunityModule]);

const STORY_EXPLANATIONS: Record<string, string> = {
  basic:
    "What it does: demonstrates the smallest usable filter with string, integer, and float fields. How it works: AiFilter is fully controlled by local React state, and onChange updates pills that are mirrored in the JSON preview.",
  hints:
    "What it does: shows field-level shortcut hints for common filter values. How it works: hints come from each field definition and are converted into pill operator/value pairs when selected.",
  async:
    "What it does: demonstrates async set-value suggestions for category and brand. How it works: each field uses an async loader plus debounce, so requests wait briefly before resolving dropdown options and hint values.",
  "behavior-ranking":
    "What it does: shows optional behavioral ranking influencing suggestion order. How it works: ranking combines exactness, usage, and recency so frequently used values can rise above pure precedence ordering.",
  "async-cancellation":
    "What it does: demonstrates request cancellation for rapid typing in async set-value lookups. How it works: each new lookup aborts the prior in-flight request via AbortSignal, preventing stale results from flashing.",
  max:
    "What it does: enforces a one-instance limit for the State field. How it works: maxInstances is applied in field config, and hint panel actions are disabled when the max count is reached.",
  prepopulated:
    "What it does: starts with an existing expression already loaded. How it works: initialPills seeds controlled state, and all subsequent edits still flow through the same onChange state loop.",
  "limited-pills":
    "What it does: constrains each pill width and shows ellipsis for long content. How it works: pillMaxWidth sets a per-pill max width and the pill label uses single-line overflow truncation.",
  "renderer-icons":
    "What it does: overrides rendering for hints, matches, and pill text on one field. How it works: field renderers receive the value, hint, or suggestion and return custom JSX with icons.",
  dates:
    "What it does: accepts date shorthand like 3m and converts it to real dates. How it works: a custom translate function runs before commit and normalizes shorthand into ISO date values.",
  custom:
    "What it does: introduces a domain-specific custom field with custom operators. How it works: custom operators are declared on the field and translate transforms shorthand values before pill creation.",
  "custom-editor":
    "What it does: edits a boolean value with a BaseUI switch instead of text input. How it works: the field's custom editor toggles between true/false, updates red/green state styling, and commits via the same onChange/onCommit lifecycle.",
  "date-fields":
    "What it does: compares default ISO date handling with a custom date format field. How it works: per-field dateFormat controls parsing/display while single and range hints inject valid date values.",
  "datetime-fields":
    "What it does: demonstrates datetime filtering with default and custom formats. How it works: hints generate concrete timestamps and the component parses datetime input using each field's format configuration.",
  "no-hints":
    "What it does: runs the filter UI without the hint panel. How it works: hintsEnabled is set to false, so users construct filters through typing and match dropdown selection only.",
  "ai-mode":
    "What it does: builds filters from natural language. How it works: text is sent to an AI resolver, the response is parsed into pills, and those pills are stored in controlled React state.",
  "nlp-resolver":
    "What it does: demonstrates natural-language filtering without an LLM server. How it works: the local resolveNlpQuery parser maps the query to pills, then returns normalized expression lines through the same AI-mode pipeline.",
  "large-dataset":
    "What it does: stress-tests performance with 100 fields and dense hints. How it works: constrained dropdown heights and multi-column hints keep navigation usable under high data volume.",
  "hundreds-hints":
    "What it does: stress-tests hint rendering with 200 set values for one field. How it works: a multi-column, scrollable hint panel presents large option sets while controlled state updates remain unchanged.",
  "ag-grid-external":
    "What it does: wires AiFilter pills into AG Grid external filtering and updates rows live. How it works: AiFilter receives the real Grid API, updates isExternalFilterPresent/doesExternalFilterPass, and AG Grid re-evaluates rows via onFilterChanged.",
  "ag-grid-large":
    "What it does: stress-tests AG Grid integration with thousands of rows and dozens of generated columns. How it works: column definitions and row data are generated once with stable memoization, AiFilter derives fields from the live Grid API, and external filtering is applied against the full dataset.",
  "hint-field-search":
    "What it does: shows a search input above the hint panel field list. How it works: hintFieldSearch=true adds a text box that filters the visible fields by name or label as the user types, making it easy to find the right field in a long list.",
  "nlp-date-shorthand":
    "What it does: adds shorthand date offsets (3d, 2w, 1m) to a date field via a ValueResolver. How it works: the resolver runs before the built-in parser; when it matches the shorthand pattern it converts the value to an ISO date and the built-in is skipped. Return undefined to fall through to normal parsing.",
  "nlp-numeric-normaliser":
    "What it does: strips currency symbols and expands k/M suffixes on all numeric fields via a global ValueResolver. How it works: a single resolver with no fieldName is invoked for every field; it returns undefined immediately for non-numeric fields so they are unaffected, and returns the normalised number for numeric ones.",
  "nlp-resolver-chain":
    "What it does: combines two ValueResolvers in a chain — date shorthand and numeric normalisation — and applies them together in a local NLP ai.resolve pipeline. How it works: resolvers are tried in array order; the first to return a non-undefined value wins. The local resolver converts pills to expression lines that the AI-mode pipeline then parses into pills.",
};

function StoryExplanation({ text }: { text: string }): JSX.Element {
  return (
    <p
      style={{
        marginBottom: "0.75rem",
        padding: "0.6rem 0.75rem",
        fontSize: "0.8rem",
        lineHeight: 1.45,
        color: "#374151",
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
      }}
    >
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Shared field definitions reused across multiple stories
// ---------------------------------------------------------------------------

const TASK_FIELDS: FieldDefinition[] = [
  {
    name: "title",
    label: "Title",
    type: "string",
    precedence: 90,
    hints: [
      { kind: "single", text: "starts with AP", operator: "<*", value: "AP" },
      { kind: "single", text: "contains bug", operator: "*", value: "bug" },
    ],
  },
  {
    name: "priority",
    label: "Priority",
    type: "integer",
    precedence: 95,
    hints: [
      { kind: "single", text: "critical (1)", operator: "=", value: 1 },
      { kind: "single", text: "high (2)", operator: "=", value: 2 },
      { kind: "range", text: "top 3", from: 1, to: 3 },
    ],
  },
  {
    name: "state",
    label: "State",
    type: "set",
    precedence: 100,
    setValues: ["New", "In Progress", "Blocked", "Done"],
    hints: "fieldValues",
  },
  {
    name: "due",
    label: "Due Date",
    type: "date",
    precedence: 70,
  },
  {
    name: "active",
    label: "Active",
    type: "boolean",
    precedence: 30,
  },
];

// ---------------------------------------------------------------------------
// Wrapper keeps pills state locally so every story is interactive
// ---------------------------------------------------------------------------
function FilterDemo({
  fields,
  initialPills = [],
  id,
  placeholder,
}: {
  fields: FieldDefinition[];
  initialPills?: FilterPill[];
  id?: string;
  placeholder?: string;
}): JSX.Element {
  const [pills, setPills] = useState<FilterPill[]>(initialPills);
  const explanation = id ? STORY_EXPLANATIONS[id] : undefined;

  return (
    <div style={{ maxWidth: 720, padding: "1.5rem" }}>
      {explanation ? <StoryExplanation text={explanation} /> : null}
      <AiFilter
        id={id}
        fields={fields}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        placeholder={placeholder}
      />
      <pre
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Story: Basic — plain string / integer fields, no async
// ---------------------------------------------------------------------------
export const Basic: Story = () => (
  <FilterDemo
    id="basic"
    fields={[
      {
        name: "name",
        label: "Name",
        type: "string",
        precedence: 80,
      },
      {
        name: "age",
        label: "Age",
        type: "integer",
        precedence: 70,
      },
      {
        name: "score",
        label: "Score",
        type: "float",
        precedence: 60,
      },
    ]}
    placeholder="Filter…"
  />
);
Basic.storyName = "Basic fields";
Basic.parameters = {
  docs: {
    description: {
      story:
        "Shows the minimal controlled setup with simple string, integer, and float fields. Filter state is kept in local React state and updated through onChange, so each interaction immediately reflects in the JSON preview.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: With hints — preconfigured shortcut values shown in the panel
// ---------------------------------------------------------------------------
export const WithHints: Story = () => <FilterDemo id="hints" fields={TASK_FIELDS} />;
WithHints.storyName = "With hints";
WithHints.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates static and field-derived hint suggestions. The hint panel is generated from each field definition and selecting a hint creates pills using the hint's operator and value mapping.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: Set field with async values + debounce
// ---------------------------------------------------------------------------

async function fetchCategories(lookup: string): Promise<string[]> {
  await new Promise((r) => setTimeout(r, 800));
  const all = ["Electronics", "Books", "Clothing", "Food & Drink", "Home & Garden", "Sports"];
  const needle = lookup.trim().toLowerCase();
  return all.filter((value) => value.toLowerCase().includes(needle));
}

async function fetchBrands(lookup: string): Promise<string[]> {
  await new Promise((r) => setTimeout(r, 700));
  const all = ["Acme Corp", "Globex", "Initech", "Umbrella", "Hooli"];
  const needle = lookup.trim().toLowerCase();
  return all.filter((value) => value.toLowerCase().includes(needle));
}

export const AsyncSetValues: Story = () => (
  <FilterDemo
    id="async"
    fields={[
      {
        name: "category",
        label: "Category",
        type: "set",
        precedence: 100,
        setValues: fetchCategories,
        setValuesDebounceMs: 300,
        hints: "fieldValues",
      },
      {
        name: "brand",
        label: "Brand",
        type: "set",
        precedence: 90,
        setValues: fetchBrands,
        setValuesDebounceMs: 200,
        hints: "fieldValues",
      },
      {
        name: "price",
        label: "Price",
        type: "float",
        precedence: 70,
        hints: [{ kind: "range", text: "budget (< 50)", from: 0, to: 49.99 }],
      },
    ]}
    placeholder="e.g. category = Books"
  />
);
AsyncSetValues.storyName = "Async set values (debounced)";
AsyncSetValues.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates async set value providers with per-field debounce. The component waits for debounced input before calling async loaders, then renders resolved options and hints from returned values.",
    },
  },
};

const BEHAVIOR_RANKING_FIELDS: FieldDefinition[] = [
  {
    name: "status",
    label: "Status",
    type: "set",
    precedence: 100,
    setValues: ["Done", "Blocked", "In Progress", "New"],
    hints: "fieldValues",
  },
  {
    name: "title",
    label: "Title",
    type: "string",
    precedence: 10,
    hints: [
      { kind: "single", text: "contains done", operator: "*", value: "done" },
      { kind: "single", text: "starts with bug", operator: "<*", value: "bug" },
    ],
  },
];

export const BehaviorRanking: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([
    {
      id: "br-seed",
      kind: "value",
      fieldName: "title",
      operator: "=",
      value: "done",
    },
  ]);

  return (
    <div style={{ maxWidth: 720, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["behavior-ranking"]} />
      <p style={{ marginBottom: "0.75rem", fontSize: "0.8rem", color: "#6b7280" }}>
        Seeded with a prior <em>title = done</em> value to provide usage/recency signal.
        Try typing <em>done</em> and compare suggestion order with ranking on.
      </p>
      <AiFilter
        id="behavior-ranking"
        fields={BEHAVIOR_RANKING_FIELDS}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        matchRanking={{
          enabled: true,
          precedenceWeight: 0.25,
          usageWeight: 30,
          recencyWeight: 20,
          exactnessWeight: 12,
        }}
        placeholder='Try: done, bug, or "status = done"'
      />
      <pre
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
BehaviorRanking.storyName = "Behavior ranking";
BehaviorRanking.parameters = {
  docs: {
    description: {
      story:
        "Shows optional matchRanking behavior. This story intentionally boosts usage/recency so previously used values can outrank strict field precedence during suggestion sorting.",
    },
  },
};

function createAbortError(): Error {
  const error = new Error("Lookup aborted");
  (error as Error & { name: string }).name = "AbortError";
  return error;
}

export const AsyncCancellation: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);
  const [stats, setStats] = useState({ started: 0, completed: 0, aborted: 0 });

  const setValues = useCallback((lookupText: string, signal?: AbortSignal): Promise<string[]> => {
    setStats((s) => ({ ...s, started: s.started + 1 }));

    return new Promise<string[]>((resolve, reject) => {
      const all = [
        "Accounting",
        "Admin",
        "Analytics",
        "Architecture",
        "Brand",
        "Compliance",
        "Data",
        "Design",
        "Engineering",
        "Finance",
        "Marketing",
        "Operations",
        "Platform",
        "Product",
        "QA",
        "Support",
      ];

      const delay = Math.max(180, 900 - lookupText.length * 120);
      const timer = setTimeout(() => {
        if (signal?.aborted) {
          reject(createAbortError());
          return;
        }

        const needle = lookupText.trim().toLowerCase();
        const values = all.filter((entry) => entry.toLowerCase().includes(needle));
        setStats((s) => ({ ...s, completed: s.completed + 1 }));
        resolve(values);
      }, delay);

      const handleAbort = (): void => {
        clearTimeout(timer);
        setStats((s) => ({ ...s, aborted: s.aborted + 1 }));
        reject(createAbortError());
      };

      signal?.addEventListener("abort", handleAbort, { once: true });
    });
  }, []);

  const fields = useMemo<FieldDefinition[]>(
    () => [
      {
        name: "team",
        label: "Team",
        type: "set",
        precedence: 100,
        setValues,
        setValuesDebounceMs: 100,
        hints: "fieldValues",
      },
      {
        name: "priority",
        label: "Priority",
        type: "integer",
        precedence: 60,
      },
    ],
    [setValues],
  );

  return (
    <div style={{ maxWidth: 760, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["async-cancellation"]} />
      <p style={{ marginBottom: "0.75rem", fontSize: "0.8rem", color: "#6b7280" }}>
        Type quickly after <em>team </em> (for example: <em>a</em>, <em>an</em>, <em>ana</em>) to trigger overlapping lookups.
        You should see aborts increment while only the latest response completes.
      </p>
      <AiFilter
        id="async-cancellation"
        fields={fields}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        placeholder='Try: team a, then quickly team an, then team ana'
      />

      <div
        style={{
          marginTop: "0.85rem",
          padding: "0.6rem 0.75rem",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          fontSize: "0.8rem",
          color: "#374151",
          background: "#f9fafb",
          display: "flex",
          gap: "0.9rem",
          flexWrap: "wrap",
        }}
      >
        <span>started: {stats.started}</span>
        <span>completed: {stats.completed}</span>
        <span>aborted: {stats.aborted}</span>
      </div>

      <pre
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
AsyncCancellation.storyName = "Async cancellation";
AsyncCancellation.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates AbortSignal-aware async setValues lookups. Rapid input starts new requests, aborts superseded in-flight lookups, and prevents stale values from updating the hint list.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: maxInstances — State can only appear once
// ---------------------------------------------------------------------------
export const MaxInstances: Story = () => (
  <FilterDemo
    id="max"
    fields={[
      ...TASK_FIELDS.map((f) =>
        f.name === "state" ? { ...f, maxInstances: 1 } : f,
      ),
    ]}
    placeholder="State can only be filtered once"
  />
);
MaxInstances.storyName = "maxInstances constraint";
MaxInstances.parameters = {
  docs: {
    description: {
      story:
        "Shows field cardinality constraints with maxInstances. The State field is restricted to one pill, and once used, further insertions for that field are disabled by the hint panel logic.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: Pre-populated pills — useful for controlled usage
// ---------------------------------------------------------------------------
export const PrePopulated: Story = () => (
  <FilterDemo
    id="prepopulated"
    fields={TASK_FIELDS}
    initialPills={[
      {
        id: "p1",
        kind: "value",
        fieldName: "state",
        operator: "=",
        value: "In Progress",
      },
      { id: "p2", kind: "and" },
      {
        id: "p3",
        kind: "value",
        fieldName: "priority",
        operator: "<=",
        value: 2,
      },
    ]}
  />
);
PrePopulated.storyName = "Pre-populated pills";
PrePopulated.parameters = {
  docs: {
    description: {
      story:
        "Shows controlled initialization with existing pills. The story starts with a preloaded expression and keeps that expression editable through normal interactions while preserving controlled state flow.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: Limited pill width — long pill text truncates with ellipsis
// ---------------------------------------------------------------------------
export const LimitedPillWidth: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([
    {
      id: "lp1",
      kind: "value",
      fieldName: "title",
      operator: "*",
      value: "This is a very long title value that should be truncated with an ellipsis",
    },
    { id: "lp2", kind: "and" },
    {
      id: "lp3",
      kind: "value",
      fieldName: "state",
      operator: "=",
      value: "In Progress",
    },
    { id: "lp4", kind: "and" },
    {
      id: "lp5",
      kind: "value",
      fieldName: "title",
      operator: "*",
      value: "Another very long description-like token to verify clipping consistency",
    },
  ]);

  return (
    <div style={{ maxWidth: 720, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["limited-pills"]} />
      <AiFilter
        id="limited-pills"
        fields={TASK_FIELDS}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        pillMaxWidth="12rem"
        placeholder="Try adding more long text values"
      />
      <pre
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
LimitedPillWidth.storyName = "Limited pill width (ellipsis)";
LimitedPillWidth.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates the pillMaxWidth property. Long pill labels are rendered on one line and truncated with ellipsis when content exceeds the configured width.",
    },
  },
};

function severityIcon(value: unknown): string {
  const v = String(value ?? "").toLowerCase();
  if (v === "critical") return "🔴";
  if (v === "high") return "🟠";
  if (v === "medium") return "🟡";
  if (v === "low") return "🟢";
  return "⚪";
}

const ICON_RENDERER_FIELDS: FieldDefinition[] = [
  {
    name: "severity",
    label: "Severity",
    type: "set",
    precedence: 100,
    setValues: ["Critical", "High", "Medium", "Low"],
    hints: "fieldValues",
    renderers: {
      hint: ({ defaultText, value, hint }) => {
        const icon = severityIcon(value ?? (hint?.kind === "single" ? hint.value : undefined));
        return <span>{icon} {defaultText}</span>;
      },
      match: ({ defaultText, value, suggestion }) => {
        const icon = severityIcon(value ?? suggestion?.setValue ?? suggestion?.text);
        return <span>{icon} {defaultText}</span>;
      },
      pill: ({ defaultText, value }) => {
        const icon = severityIcon(value);
        return <span>{icon} {defaultText}</span>;
      },
    },
  },
  {
    name: "title",
    label: "Title",
    type: "string",
    precedence: 90,
  },
];

export const RendererIcons: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([
    {
      id: "ri1",
      kind: "value",
      fieldName: "severity",
      operator: "=",
      value: "High",
    },
  ]);

  return (
    <div style={{ maxWidth: 720, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["renderer-icons"]} />
      <p style={{ marginBottom: "0.75rem", fontSize: "0.8rem", color: "#6b7280" }}>
        Try typing <em>severity</em> and picking values to see icon rendering in matches,
        hints, and resulting pills.
      </p>
      <AiFilter
        id="renderer-icons"
        fields={ICON_RENDERER_FIELDS}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        placeholder="Try: severity = critical"
      />
      <pre
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
RendererIcons.storyName = "Renderer overrides (icons)";
RendererIcons.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates field-level renderers that override hint rows, match rows, and pill text. The severity field renders a status icon based on the current value across all three surfaces.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: Date field with custom translator (e.g. "3m" → ISO date)
// ---------------------------------------------------------------------------
export const DateWithTranslator: Story = () => (
  <FilterDemo
    id="dates"
    fields={[
      {
        name: "due",
        label: "Due Date",
        type: "date",
        precedence: 80,
        translate: (text) => {
          const match = text.match(/^(\d+)([dwmy])$/i);
          if (!match) return text;
          const n = Number(match[1]);
          const unit = match[2].toLowerCase();
          const dt = new Date();
          if (unit === "d") dt.setDate(dt.getDate() + n);
          else if (unit === "w") dt.setDate(dt.getDate() + n * 7);
          else if (unit === "m") dt.setMonth(dt.getMonth() + n);
          else if (unit === "y") dt.setFullYear(dt.getFullYear() + n);
          return dt.toISOString();
        },
        hints: [
          { kind: "single", text: "today", operator: "=", value: new Date().toISOString().slice(0, 10) },
          { kind: "single", text: "next 7 days", operator: "<=", value: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString(); })() },
        ],
      },
    ]}
    placeholder='Try "due = 3m" or pick a hint'
  />
);
DateWithTranslator.storyName = "Date with translator";
DateWithTranslator.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates custom value translation for date input. A translator converts shorthand values like 3m into ISO datetimes before pill commit, while hints provide quick date shortcuts.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: Custom field type with custom operators
// ---------------------------------------------------------------------------
export const CustomFieldType: Story = () => (
  <FilterDemo
    id="custom"
    fields={[
      {
        name: "window",
        label: "Time Window",
        type: "custom",
        precedence: 85,
        operators: ["=", "!", "within", "outside"],
        translate: (text) => {
          const match = text.match(/^(\d+)d$/i);
          if (!match) return text;
          const now = Date.now();
          return new Date(now + Number(match[1]) * 24 * 3600 * 1000).toISOString();
        },
        hints: [
          { kind: "single", text: "next 7 days", operator: "within", value: "7d" },
          { kind: "single", text: "next 30 days", operator: "within", value: "30d" },
        ],
      },
    ]}
    placeholder='Try "window within 7d"'
  />
);
CustomFieldType.storyName = "Custom field type";
CustomFieldType.parameters = {
  docs: {
    description: {
      story:
        "Shows a custom field type with custom operators and translation rules. The field accepts domain-specific operators (within/outside) and transforms shorthand values prior to filter evaluation.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: No hints panel (hintsEnabled = false)
// ---------------------------------------------------------------------------
export const NoHints: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);
  return (
    <div style={{ maxWidth: 720, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["no-hints"]} />
      <AiFilter
        id="no-hints"
        fields={TASK_FIELDS}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        hintsEnabled={false}
        placeholder="Type to filter (no hint panel)"
      />
    </div>
  );
};
NoHints.storyName = "Hints disabled";
NoHints.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates the same controlled filter experience with the hint panel disabled. Users build filters through typing and dropdown selection only, useful for compact UIs.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: Custom editor for a field
// ---------------------------------------------------------------------------
export const CustomEditor: Story = () => (
  <FilterDemo
    id="custom-editor"
    fields={[
      {
        name: "active",
        label: "Active",
        type: "boolean",
        precedence: 80,
        operators: ["="],
        hints: [
          { kind: "single", text: "is on", operator: "=", value: true },
          { kind: "single", text: "is off", operator: "=", value: false },
        ],
        editor: ({ value, onChange, onCommit, onCancel }) => (
          <Switch.Root
            checked={value === "true"}
            onCheckedChange={(checked) => {
              onChange(checked ? "true" : "false");
              onCommit();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel();
            }}
            aria-label="Toggle active"
            style={{
              width: 56,
              height: 30,
              borderRadius: 999,
              border: "1px solid #d1d5db",
              cursor: "pointer",
              padding: 2,
              display: "inline-flex",
              alignItems: "center",
              background: value === "true" ? "#16a34a" : "#dc2626",
              transition: "background-color 120ms ease",
            }}
          >
            <Switch.Thumb
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: "#ffffff",
                color: value === "true" ? "#166534" : "#991b1b",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                transform: value === "true" ? "translateX(26px)" : "translateX(0)",
                transition: "transform 120ms ease",
              }}
            >
              {value === "true" ? "✓" : "✕"}
            </Switch.Thumb>
          </Switch.Root>
        ),
      },
    ]}
    placeholder='Type: active = true, then double-click value to toggle'
  />
);
CustomEditor.storyName = "Custom editor";
CustomEditor.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates a custom in-place editor for boolean pills. The active field uses a BaseUI switch with red/green states and ON/OFF thumb icons, wired to onChange/onCommit/onCancel for the standard pill lifecycle.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: Date fields — plain date, custom format, date range hint
// ---------------------------------------------------------------------------
export const DateFields: Story = () => (
  <FilterDemo
    id="date-fields"
    fields={[
      {
        name: "due",
        label: "Due Date",
        type: "date",
        precedence: 90,
        hints: [
          { kind: "single", text: "today", operator: "=", value: new Date().toISOString().slice(0, 10) },
          {
            kind: "single",
            text: "next 7 days",
            operator: "<=",
            value: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })(),
          },
          {
            kind: "range",
            text: "this month",
            from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
            to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
          },
        ],
      },
      {
        name: "created",
        label: "Created (dd/MM/yyyy)",
        type: "date",
        precedence: 80,
        dateFormat: "dd/MM/yyyy",
        hints: [
          {
            kind: "single",
            text: "today",
            operator: "=",
            value: new Date().toISOString().slice(0, 10),
          },
        ],
      },
    ]}
    placeholder='e.g. due <= 2025-12-31'
  />
);
DateFields.storyName = "Date fields";
DateFields.parameters = {
  docs: {
    description: {
      story:
        "Shows native date field behavior with ISO and formatted display input. It combines single-date and range hints and demonstrates per-field date formatting support.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: Datetime fields — default yyyy-MM-dd HH:mm:ss and custom format
// ---------------------------------------------------------------------------
export const DatetimeFields: Story = () => (
  <FilterDemo
    id="datetime-fields"
    fields={[
      {
        name: "updatedAt",
        label: "Updated At",
        type: "datetime",
        precedence: 90,
        hints: [
          {
            kind: "single",
            text: "last hour",
            operator: ">=",
            value: (() => { const d = new Date(); d.setHours(d.getHours() - 1); return d.toISOString(); })(),
          },
          {
            kind: "single",
            text: "today",
            operator: ">=",
            value: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); })(),
          },
        ],
      },
      {
        name: "scheduledAt",
        label: "Scheduled (yyyy-MM-dd HH:mm)",
        type: "datetime",
        precedence: 80,
        dateFormat: "yyyy-MM-dd HH:mm",
        hints: [
          {
            kind: "range",
            text: "next 24 hours",
            from: new Date().toISOString(),
            to: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString(); })(),
          },
        ],
      },
    ]}
    placeholder='e.g. updatedAt >= 2025-06-01 12:00:00'
  />
);
DatetimeFields.storyName = "Datetime fields";
DatetimeFields.parameters = {
  docs: {
    description: {
      story:
        "Shows datetime parsing and formatting behavior, including default and custom datetime formats. Relative-time hints are resolved into concrete ISO timestamps for pill creation.",
    },
  },
};

const dueShorthandResolver: ValueResolver = {
  fieldName: "due",
  resolve: ({ rawValue }) => {
    const match = rawValue.match(/^(\d+)m$/i);
    if (!match) return undefined;
    const dt = new Date();
    dt.setMonth(dt.getMonth() + Number(match[1]));
    return dt.toISOString().slice(0, 10);
  },
};

/** Parse "Nd" shorthand for the "window" custom field (N days from now). */
const windowShorthandResolver: ValueResolver = {
  fieldName: "window",
  resolve: ({ rawValue }) => {
    const match = rawValue.match(/^(\d+)d$/i);
    if (!match) return undefined;
    return new Date(Date.now() + Number(match[1]) * 24 * 3600 * 1000).toISOString();
  },
};

const VALUE_RESOLVERS: ValueResolver[] = [dueShorthandResolver, windowShorthandResolver];

export const NlpResolver: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);

  const localConfig = {
    resolve: async (prompt: string): Promise<string> => {
      const queryMatch = prompt.match(/^Query:\s*(.+)$/m);
      const query = queryMatch?.[1]?.trim() ?? "";
      if (!query) return "";

      const pills = resolveNlpQuery(query, TASK_FIELDS, {
        valueResolvers: VALUE_RESOLVERS
      });

      return pills
        .map((pill) => {
          if (pill.kind === "and") return "AND";
          if (pill.kind === "or") return "OR";
          if (pill.kind === "open-bracket") return "(";
          if (pill.kind === "close-bracket") return ")";
          if (pill.kind === "value") return `${pill.fieldName} ${pill.operator} ${String(pill.value)}`;
          if (pill.kind === "range") return `${pill.fieldName} from ${String(pill.from)} to ${String(pill.to)}`;
          if (pill.kind === "list") return `${pill.fieldName} in ${(pill.values as unknown[]).map(String).join(",")}`;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
  };

  return (
    <div style={{ maxWidth: 720, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["nlp-resolver"]} />
      <p style={{ marginBottom: "0.75rem", fontSize: "0.8rem", color: "#6b7280" }}>
        Uses the built-in NLP parser only (no network). Try:
        <em>"state one of Blocked, In Progress and priority at most 2"</em>,
        <em>"due next week"</em>, or <em>"active is true"</em>.
      </p>
      <AiFilter
        id="nlp-resolver"
        fields={TASK_FIELDS}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        ai={localConfig}
        placeholder="Describe a filter in plain language (local NLP)…"
      />
      <pre
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
NlpResolver.storyName = "AI mode (local nlp resolver)";
NlpResolver.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates AI-mode UX with a local resolver using resolveNlpQuery. The resolver extracts the original query from the generated prompt, parses it into pills, then emits expression lines that reuse the existing AI parsing pipeline.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: Large dataset — 100 fields each with multiple hints,
//        one set field with 100 values, constrained heights, 3-column hints
// ---------------------------------------------------------------------------

// 100 set values for the "category" field
const CATEGORY_VALUES: string[] = [
  "Accounting", "Administration", "Advertising", "Analytics", "Architecture",
  "Art & Design", "Audit", "Business Development", "Cloud Infrastructure",
  "Compliance", "Content", "Customer Success", "Data Engineering",
  "Data Science", "DevOps", "Documentation", "E-Commerce", "Education",
  "Engineering", "Enterprise", "Finance", "Front-End", "Growth",
  "HR", "Hardware", "Health & Safety", "Identity", "Infrastructure",
  "Integrations", "IT Support", "Legal", "Localisation", "Logistics",
  "Machine Learning", "Marketing", "Mobile", "Networking", "Operations",
  "Partnerships", "Payments", "Platform", "Product", "Procurement",
  "QA", "Release", "Research", "Risk", "Sales", "Security", "SEO",
  "Site Reliability", "Social Media", "Strategy", "Supply Chain",
  "Support", "Talent", "Tax", "Testing", "Training", "UX",
  "Back-End", "Billing", "Brand", "Budget", "Caching", "CI/CD",
  "Communications", "CRM", "Database", "Deployment", "Embedded",
  "Events", "Experimentation", "Feature Flags", "Firmware", "Forecasting",
  "Game Development", "Governance", "Incident Response", "Internal Tools",
  "IoT", "Monitoring", "Notifications", "Observability", "Onboarding",
  "Open Source", "Optimisation", "Permissions", "Pipeline", "Portal",
  "Privacy", "Prototyping", "Publishing", "Reporting", "Robotics",
  "Scheduling", "SDK", "Simulation", "Telemetry", "Tooling", "Workflow",
];

// Helper — build hints for a numeric (integer/float) field
function numericHints(low: number, mid: number, high: number): Hint[] {
  return [
    { kind: "single", text: `= ${low} (low)`,  operator: "=",  value: low  },
    { kind: "single", text: `= ${mid} (mid)`,  operator: "=",  value: mid  },
    { kind: "single", text: `= ${high} (high)`,operator: "=",  value: high },
    { kind: "single", text: `> ${mid}`,         operator: ">",  value: mid  },
    { kind: "single", text: `< ${mid}`,         operator: "<",  value: mid  },
    { kind: "range",  text: `${low} – ${mid}`,  from: low, to: mid  },
    { kind: "range",  text: `${mid} – ${high}`, from: mid, to: high },
  ];
}

// Helper — build date hints
function dateHints(): Hint[] {
  const today = new Date().toISOString().slice(0, 10);
  const add = (days: number): string => {
    const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
  };
  return [
    { kind: "single", text: "today",           operator: "=",  value: today      },
    { kind: "single", text: "tomorrow",        operator: "=",  value: add(1)     },
    { kind: "single", text: "overdue",         operator: "<",  value: today      },
    { kind: "single", text: "due this week",   operator: "<=", value: add(7)     },
    { kind: "single", text: "due next month",  operator: "<=", value: add(30)    },
    { kind: "range",  text: "next 7 days",     from: today,    to: add(7)        },
    { kind: "range",  text: "next 30 days",    from: today,    to: add(30)       },
    { kind: "range",  text: "next quarter",    from: today,    to: add(90)       },
  ];
}

// Helper — string hints
function stringHints(label: string): Hint[] {
  return [
    { kind: "single", text: `starts with A`,    operator: "<*", value: "A"        },
    { kind: "single", text: `contains ${label}`,operator: "*",  value: label      },
    { kind: "single", text: `not empty`,        operator: "!*", value: ""         },
  ];
}

const HUNDRED_FIELDS: FieldDefinition[] = [
  // ── Set field with 100 values (highest precedence, shown first in hint panel)
  {
    name: "category",
    label: "Category",
    type: "set",
    precedence: 1,
    setValues: CATEGORY_VALUES,
    hints: "fieldValues",
  },
  // ── String fields
  { name: "title",       label: "Title",       type: "string",  precedence:  2, hints: stringHints("title")   },
  { name: "description", label: "Description", type: "string",  precedence:  3, hints: stringHints("keyword") },
  { name: "assignee",    label: "Assignee",    type: "string",  precedence:  4, hints: stringHints("Alice")   },
  { name: "reporter",    label: "Reporter",    type: "string",  precedence:  5, hints: stringHints("Bob")     },
  { name: "component",   label: "Component",   type: "string",  precedence:  6, hints: stringHints("core")    },
  { name: "version",     label: "Version",     type: "string",  precedence:  7, hints: stringHints("v1")      },
  { name: "environment", label: "Environment", type: "string",  precedence:  8, hints: stringHints("prod")    },
  { name: "region",      label: "Region",      type: "string",  precedence:  9, hints: stringHints("us-east") },
  { name: "team",        label: "Team",        type: "string",  precedence: 10, hints: stringHints("platform")},
  { name: "project",     label: "Project",     type: "string",  precedence: 11, hints: stringHints("atlas")   },
  { name: "sprint",      label: "Sprint",      type: "string",  precedence: 12, hints: stringHints("sprint-")  },
  { name: "milestone",   label: "Milestone",   type: "string",  precedence: 13, hints: stringHints("M1")      },
  { name: "label",       label: "Label",       type: "string",  precedence: 14, hints: stringHints("bug")     },
  { name: "tag",         label: "Tag",         type: "string",  precedence: 15, hints: stringHints("backend") },
  // ── Integer fields
  { name: "priority",    label: "Priority",    type: "integer", precedence: 16, hints: numericHints(1, 3, 5)   },
  { name: "severity",    label: "Severity",    type: "integer", precedence: 17, hints: numericHints(1, 3, 5)   },
  { name: "story_points",label: "Story Points",type: "integer", precedence: 18, hints: numericHints(1, 5, 13)  },
  { name: "votes",       label: "Votes",       type: "integer", precedence: 19, hints: numericHints(0, 10, 50)  },
  { name: "watchers",    label: "Watchers",    type: "integer", precedence: 20, hints: numericHints(0, 5, 20)   },
  { name: "comments",    label: "Comments",    type: "integer", precedence: 21, hints: numericHints(0, 5, 20)   },
  { name: "retries",     label: "Retries",     type: "integer", precedence: 22, hints: numericHints(0, 2, 5)    },
  { name: "depth",       label: "Depth",       type: "integer", precedence: 23, hints: numericHints(0, 3, 10)   },
  { name: "rank",        label: "Rank",        type: "integer", precedence: 24, hints: numericHints(1, 50, 100) },
  { name: "order",       label: "Order",       type: "integer", precedence: 25, hints: numericHints(1, 10, 100) },
  // ── Float fields
  { name: "cost",        label: "Cost",        type: "float",   precedence: 26, hints: numericHints(0, 50, 1000)   },
  { name: "revenue",     label: "Revenue",     type: "float",   precedence: 27, hints: numericHints(0, 500, 10000)  },
  { name: "budget",      label: "Budget",      type: "float",   precedence: 28, hints: numericHints(0, 5000, 50000) },
  { name: "score",       label: "Score",       type: "float",   precedence: 29, hints: numericHints(0, 5, 10)       },
  { name: "confidence",  label: "Confidence",  type: "float",   precedence: 30, hints: numericHints(0, 0.5, 1)      },
  { name: "progress",    label: "Progress",    type: "float",   precedence: 31, hints: numericHints(0, 0.5, 1)      },
  { name: "load",        label: "Load",        type: "float",   precedence: 32, hints: numericHints(0, 0.5, 1)      },
  { name: "cpu",         label: "CPU %",       type: "float",   precedence: 33, hints: numericHints(0, 50, 100)     },
  { name: "memory",      label: "Memory %",    type: "float",   precedence: 34, hints: numericHints(0, 50, 100)     },
  { name: "latency_ms",  label: "Latency (ms)",type: "float",   precedence: 35, hints: numericHints(0, 100, 1000)   },
  // ── Boolean fields
  { name: "active",      label: "Active",      type: "boolean", precedence: 36 },
  { name: "archived",    label: "Archived",    type: "boolean", precedence: 37 },
  { name: "draft",       label: "Draft",       type: "boolean", precedence: 38 },
  { name: "pinned",      label: "Pinned",      type: "boolean", precedence: 39 },
  { name: "locked",      label: "Locked",      type: "boolean", precedence: 40 },
  { name: "flagged",     label: "Flagged",     type: "boolean", precedence: 41 },
  { name: "verified",    label: "Verified",    type: "boolean", precedence: 42 },
  { name: "published",   label: "Published",   type: "boolean", precedence: 43 },
  { name: "reviewed",    label: "Reviewed",    type: "boolean", precedence: 44 },
  { name: "blocked",     label: "Blocked",     type: "boolean", precedence: 45 },
  // ── Date fields
  { name: "due",         label: "Due Date",    type: "date",    precedence: 46, hints: dateHints() },
  { name: "created_at",  label: "Created",     type: "date",    precedence: 47, hints: dateHints() },
  { name: "updated_at",  label: "Updated",     type: "date",    precedence: 48, hints: dateHints() },
  { name: "resolved_at", label: "Resolved",    type: "date",    precedence: 49, hints: dateHints() },
  { name: "closed_at",   label: "Closed",      type: "date",    precedence: 50, hints: dateHints() },
  { name: "started_at",  label: "Started",     type: "date",    precedence: 51, hints: dateHints() },
  { name: "deployed_at", label: "Deployed",    type: "date",    precedence: 52, hints: dateHints() },
  { name: "merged_at",   label: "Merged",      type: "date",    precedence: 53, hints: dateHints() },
  { name: "reviewed_at", label: "Reviewed At", type: "date",    precedence: 54, hints: dateHints() },
  { name: "expires_at",  label: "Expires",     type: "date",    precedence: 55, hints: dateHints() },
  // ── Additional string fields to reach 100
  ...Array.from({ length: 45 }, (_, i) => ({
    name: `attr_${i + 1}`,
    label: `Attribute ${i + 1}`,
    type: "string" as const,
    precedence: 56 + i,
    hints: stringHints(`attr${i + 1}`),
  })),
];

export const LargeDataset: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);
  return (
    <div style={{ maxWidth: 820, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["large-dataset"]} />
      <AiFilter
        id="large-dataset"
        fields={HUNDRED_FIELDS}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        placeholder='Try "category", "priority", "due", "cost", "active"…'
        matchDropdownMaxHeight="14rem"
        hintPanelMaxHeight="20rem"
        hintColumns={3}
      />
      <pre
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
LargeDataset.storyName = "Large dataset (100 fields + 100 values)";
LargeDataset.parameters = {
  docs: {
    description: {
      story:
        "Stress-tests scale with 100 fields, dense hints, and large set values. It demonstrates constrained panel heights, multi-column hints, and responsiveness under heavy option volume.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: Hundreds of hints — single field with 200 hints, 4-column panel
// ---------------------------------------------------------------------------

const PRODUCT_NAMES: string[] = Array.from({ length: 200 }, (_, i) => {
  const adjectives = ["Fast","Smart","Bold","Lean","Core","Edge","Peak","Plus",
    "Pro","Max","Ultra","Nano","Micro","Mini","Mega","Super","Hyper","Nova",
    "Prime","Elite","Lite","Flex","Swift","Sharp","Clean","Bright","Deep"];
  const nouns = ["Flow","Link","Node","Hub","Grid","Stack","Base","Port",
    "Gate","Pulse","Drive","Track","Sync","Loop","Beam","Wave","Path",
    "Point","Mark","Block","Chain","Vault","Scope","View","Dash","Map"];
  return `${adjectives[i % adjectives.length]} ${nouns[i % nouns.length]} ${Math.floor(i / adjectives.length) + 1}`;
});

const HUNDREDS_OF_HINTS_FIELDS: FieldDefinition[] = [
  {
    name: "product",
    label: "Product",
    type: "set",
    precedence: 1,
    setValues: PRODUCT_NAMES,
    hints: "fieldValues",
  },
  {
    name: "region",
    label: "Region",
    type: "set",
    precedence: 2,
    setValues: ["APAC", "EMEA", "LATAM", "NA", "SA"],
    hints: "fieldValues",
  },
  {
    name: "revenue",
    label: "Revenue",
    type: "float",
    precedence: 3,
    hints: numericHints(0, 10000, 1000000),
  },
];

export const HundredsOfHints: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);
  return (
    <div style={{ maxWidth: 820, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["hundreds-hints"]} />
      <AiFilter
        id="hundreds-hints"
        fields={HUNDREDS_OF_HINTS_FIELDS}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        placeholder='Click inside or type "product"…'
        matchDropdownMaxHeight="10rem"
        hintPanelMaxHeight="22rem"
        hintColumns={4}
        suggestionsDropdownSticky={true}
      />
      <pre
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
HundredsOfHints.storyName = "Hundreds of hints (200 values, 4 columns)";
HundredsOfHints.parameters = {
  docs: {
    description: {
      story:
        "Focuses on extreme hint density for a single field. The Product field exposes 200 values rendered in a scrollable multi-column hint panel to validate discoverability and interaction performance.",
    },
  },
};

type DemoRow = {
  id: number;
  title: string;
  priority: number;
  status: string;
  active: boolean;
  due: string;
};

type LargeGridCellValue = string | number | boolean;
type LargeGridRow = Record<string, LargeGridCellValue>;

const LARGE_GRID_STATUSES = ["New", "In Progress", "Blocked", "Done", "Archived"];
const LARGE_GRID_REGIONS = ["NA", "EMEA", "APAC", "LATAM"];
const LARGE_GRID_TEAMS = ["Platform", "Growth", "Ops", "Design", "Data", "Infra"];

function makeLargeGridColumnDefs(): ColDef<LargeGridRow>[] {
  const columns: ColDef<LargeGridRow>[] = [
    { field: "recordId", headerName: "Record ID", cellDataType: "number", filter: "agNumberColumnFilter" },
    { field: "title", headerName: "Title", cellDataType: "text", filter: "agTextColumnFilter" },
    {
      field: "status",
      headerName: "Status",
      cellDataType: "text",
      filter: "agSetColumnFilter",
      filterParams: { values: LARGE_GRID_STATUSES },
    },
    {
      field: "region",
      headerName: "Region",
      cellDataType: "text",
      filter: "agSetColumnFilter",
      filterParams: { values: LARGE_GRID_REGIONS },
    },
    {
      field: "team",
      headerName: "Team",
      cellDataType: "text",
      filter: "agSetColumnFilter",
      filterParams: { values: LARGE_GRID_TEAMS },
    },
    { field: "active", headerName: "Active", cellDataType: "boolean", filter: "agTextColumnFilter" },
    { field: "priority", headerName: "Priority", cellDataType: "number", filter: "agNumberColumnFilter" },
    { field: "createdOn", headerName: "Created", cellDataType: "dateString", filter: "agDateColumnFilter" },
  ];

  for (let index = 1; index <= 8; index += 1) {
    columns.push({
      field: `metric${index}`,
      headerName: `Metric ${index}`,
      cellDataType: "number",
      filter: "agNumberColumnFilter",
    });
  }

  for (let index = 1; index <= 6; index += 1) {
    columns.push({
      field: `flag${index}`,
      headerName: `Flag ${index}`,
      cellDataType: "boolean",
      filter: "agTextColumnFilter",
    });
  }

  for (let index = 1; index <= 10; index += 1) {
    columns.push({
      field: `label${index}`,
      headerName: `Label ${index}`,
      cellDataType: "text",
      filter: "agTextColumnFilter",
    });
  }

  return columns;
}

function makeLargeGridRows(rowCount: number): LargeGridRow[] {
  return Array.from({ length: rowCount }, (_, index) => {
    const status = LARGE_GRID_STATUSES[index % LARGE_GRID_STATUSES.length];
    const region = LARGE_GRID_REGIONS[index % LARGE_GRID_REGIONS.length];
    const team = LARGE_GRID_TEAMS[index % LARGE_GRID_TEAMS.length];
    const month = ((index % 9) + 1).toString().padStart(2, "0");
    const day = ((index % 27) + 1).toString().padStart(2, "0");

    const row: LargeGridRow = {
      recordId: index + 1,
      title: `Task ${index + 1} - ${team} ${region}`,
      status,
      region,
      team,
      active: index % 3 !== 0,
      priority: (index % 5) + 1,
      createdOn: `2026-${month}-${day}`,
    };

    for (let metricIndex = 1; metricIndex <= 8; metricIndex += 1) {
      row[`metric${metricIndex}`] = ((index + 1) * (metricIndex + 3)) % 997;
    }

    for (let flagIndex = 1; flagIndex <= 6; flagIndex += 1) {
      row[`flag${flagIndex}`] = (index + flagIndex) % 2 === 0;
    }

    for (let labelIndex = 1; labelIndex <= 10; labelIndex += 1) {
      row[`label${labelIndex}`] = `Group ${((index + labelIndex) % 24) + 1}`;
    }

    return row;
  });
}

const AG_GRID_ROWS: DemoRow[] = [
  { id: 1, title: "Login bug", priority: 1, status: "New", active: true, due: "2026-05-01" },
  { id: 2, title: "UI polish", priority: 3, status: "In Progress", active: true, due: "2026-05-15" },
  { id: 3, title: "Data migration", priority: 5, status: "Done", active: false, due: "2026-04-20" },
  { id: 4, title: "Release checklist", priority: 2, status: "Blocked", active: true, due: "2026-05-20" },
  { id: 5, title: "Search refactor", priority: 4, status: "Done", active: true, due: "2026-06-01" },
];

export const AgGridExternalFilter: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);
  const [filterChangeCount, setFilterChangeCount] = useState(0);
  const [gridApi, setGridApi] = useState<AgGridApi | undefined>();

  const columnDefs = useMemo<ColDef<DemoRow>[]>(
    () => [
      { field: "title", headerName: "Title", cellDataType: "text", filter: "agTextColumnFilter" },
      { field: "priority", headerName: "Priority", cellDataType: "number", filter: "agNumberColumnFilter" },
      {
        field: "status",
        headerName: "Status",
        cellDataType: "text",
        filter: "agSetColumnFilter",
        filterParams: { values: ["New", "In Progress", "Blocked", "Done"] },
      },
      { field: "active", headerName: "Active", cellDataType: "boolean", filter: "agTextColumnFilter" },
      { field: "due", headerName: "Due", cellDataType: "dateString", filter: "agDateColumnFilter" },
    ],
    [],
  );

  const fields = useMemo<FieldDefinition[]>(
    () => [
      {
        name: "status",
        label: "Workflow Status",
        type: "set",
        precedence: 100,
        setValues: ["New", "In Progress", "Blocked", "Done"],
        hints: "fieldValues",
      },
    ],
    [],
  );

  const handleGridReady = useCallback((event: GridReadyEvent<DemoRow>): void => {
    setGridApi(event.api as unknown as AgGridApi);
  }, []);

  const handleFilterChange = useCallback(() => {
    setFilterChangeCount((count) => count + 1);
  }, []);

  const handleClear = useCallback(() => {
    setPills([]);
  }, []);

  return (
    <div style={{ maxWidth: 900, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["ag-grid-external"]} />
      <AiFilter
        id="ag-grid-external"
        agGrid={gridApi}
        fields={fields}
        pills={pills}
        onChange={setPills}
        onClear={handleClear}
        onFilterChange={handleFilterChange}
        placeholder='Try: status = Done AND priority <= 3'
      />

      <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#4b5563" }}>
        Filter updates: {filterChangeCount}
      </div>

      <div className="ag-theme-alpine" style={{ marginTop: "0.75rem", height: 280, width: "100%" }}>
        <AgGridReact<DemoRow>
          rowData={AG_GRID_ROWS}
          columnDefs={columnDefs}
          onGridReady={handleGridReady}
          animateRows={true}
        />
      </div>
    </div>
  );
};
AgGridExternalFilter.storyName = "AG Grid external filter";
AgGridExternalFilter.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates AiFilter building AG Grid external filter callbacks from pills and applying them to a live AG Grid instance. It also shows field override behavior by replacing the generated status field label with a custom one.",
    },
  },
};

export const AgGridLargeDataset: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);
  const [filterChangeCount, setFilterChangeCount] = useState(0);
  const [gridApi, setGridApi] = useState<AgGridApi | undefined>();

  const columnDefs = useMemo<ColDef<LargeGridRow>[]>(() => makeLargeGridColumnDefs(), []);
  const rowData = useMemo<LargeGridRow[]>(() => makeLargeGridRows(10000), []);

  const fields = useMemo<FieldDefinition[]>(
    () => [
      {
        name: "status",
        label: "Workflow Status",
        type: "set",
        precedence: 100,
        setValues: LARGE_GRID_STATUSES,
        hints: "fieldValues",
      },
      {
        name: "region",
        label: "Region",
        type: "set",
        precedence: 95,
        setValues: LARGE_GRID_REGIONS,
        hints: "fieldValues",
      },
      {
        name: "team",
        label: "Team",
        type: "set",
        precedence: 90,
        setValues: LARGE_GRID_TEAMS,
        hints: "fieldValues",
      },
    ],
    [],
  );

  const handleGridReady = useCallback((event: GridReadyEvent<LargeGridRow>): void => {
    setGridApi(event.api as unknown as AgGridApi);
  }, []);

  const handleFilterChange = useCallback(() => {
    setFilterChangeCount((count) => count + 1);
  }, []);

  return (
    <div style={{ maxWidth: 1400, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["ag-grid-large"]} />
      <AiFilter
        id="ag-grid-large"
        agGrid={gridApi}
        fields={fields}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        onFilterChange={handleFilterChange}
        placeholder='Try: status = Done AND priority <= 2 AND region = EMEA'
        hintPanelMaxHeight="16rem"
        matchDropdownMaxHeight="14rem"
      />

      <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#4b5563" }}>
        Rows: {rowData.length} | Columns: {columnDefs.length} | Filter updates: {filterChangeCount}
      </div>

      <div className="ag-theme-alpine" style={{ marginTop: "0.75rem", height: 560, width: "100%" }}>
        <AgGridReact<LargeGridRow>
          rowData={rowData}
          columnDefs={columnDefs}
          onGridReady={handleGridReady}
          animateRows={false}
          pagination={true}
          paginationPageSize={100}
        />
      </div>
    </div>
  );
};
AgGridLargeDataset.storyName = "AG Grid large dataset";
AgGridLargeDataset.parameters = {
  docs: {
    description: {
      story:
        "Exercises AiFilter against a much larger AG Grid surface: thousands of rows, dozens of columns, generated numeric/text/boolean/set/date fields, and live external filtering through the real grid API.",
    },
  },
};

// ---------------------------------------------------------------------------
// Stories: Line height variants
// ---------------------------------------------------------------------------

export const LineHeight12: Story = () => (
  <div style={{ maxWidth: 720, padding: "1.5rem", lineHeight: 1.2 }}>
    <FilterDemo id="line-height-12" fields={TASK_FIELDS} />
  </div>
);
LineHeight12.storyName = "Line height 1.2";
LineHeight12.parameters = {
  docs: {
    description: {
      story: "Renders AiFilter inside a container with line-height: 1.2.",
    },
  },
};

export const LineHeight13: Story = () => (
  <div style={{ maxWidth: 720, padding: "1.5rem", lineHeight: 1.3 }}>
    <FilterDemo id="line-height-13" fields={TASK_FIELDS} />
  </div>
);
LineHeight13.storyName = "Line height 1.3";
LineHeight13.parameters = {
  docs: {
    description: {
      story: "Renders AiFilter inside a container with line-height: 1.3.",
    },
  },
};

export const LineHeight14: Story = () => (
  <div style={{ maxWidth: 720, padding: "1.5rem", lineHeight: 1.4 }}>
    <FilterDemo id="line-height-14" fields={TASK_FIELDS} />
  </div>
);
LineHeight14.storyName = "Line height 1.4";
LineHeight14.parameters = {
  docs: {
    description: {
      story: "Renders AiFilter inside a container with line-height: 1.4.",
    },
  },
};

export const LineHeight15: Story = () => (
  <div style={{ maxWidth: 720, padding: "1.5rem", lineHeight: 1.5 }}>
    <FilterDemo id="line-height-15" fields={TASK_FIELDS} />
  </div>
);
LineHeight15.storyName = "Line height 1.5";
LineHeight15.parameters = {
  docs: {
    description: {
      story: "Renders AiFilter inside a container with line-height: 1.5.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: hintOrder — controls field position in the hint panel
// ---------------------------------------------------------------------------

export const HintOrder: Story = () => (
  <FilterDemo
    id="hint-order"
    fields={[
      {
        name: "title",
        label: "Title",
        type: "string",
        precedence: 10,
        // No hintOrder — will appear after all ordered fields
      },
      {
        name: "status",
        label: "Status",
        type: "set",
        precedence: 20,
        setValues: ["New", "In Progress", "Done"],
        hintOrder: 3,
      },
      {
        name: "priority",
        label: "Priority",
        type: "integer",
        precedence: 30,
        hints: [
          { kind: "single", text: "Critical (1)", operator: "=", value: 1 },
          { kind: "single", text: "High (2)", operator: "=", value: 2 },
          { kind: "single", text: "Low (3)", operator: "=", value: 3 },
        ],
        hintOrder: 1,
      },
      {
        name: "assignee",
        label: "Assignee",
        type: "string",
        precedence: 40,
        hintOrder: 2,
      },
      {
        name: "due",
        label: "Due Date",
        type: "date",
        precedence: 50,
        // No hintOrder — will appear after all ordered fields
      },
    ]}
    placeholder="Open the hint panel to see field order: Priority → Assignee → Status → Title → Due Date"
  />
);
HintOrder.storyName = "Hint field order";
HintOrder.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates the hintOrder field property. Fields with a lower hintOrder appear earlier in the hint panel field list. Fields without hintOrder are sorted after all ordered fields and preserve their original definition order. Here: Priority (1) → Assignee (2) → Status (3) → Title → Due Date.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: hintFieldSearch — search box above the hint panel field list
// ---------------------------------------------------------------------------

export const HintFieldSearch: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);
  return (
    <div style={{ maxWidth: 720, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["hint-field-search"]} />
      <p style={{ marginBottom: "0.75rem", fontSize: "0.8rem", color: "#6b7280" }}>
        Click inside the filter, then type in the <em>Search fields…</em> box to narrow the list.
        Try searching for <em>"due"</em>, <em>"pri"</em>, or <em>"sta"</em>.
      </p>
      <AiFilter
        id="hint-field-search"
        fields={[
          { name: "title",    label: "Title",       type: "string",  precedence: 10 },
          { name: "priority", label: "Priority",    type: "integer", precedence: 20,
            hints: [
              { kind: "single", text: "Critical (1)", operator: "=", value: 1 },
              { kind: "single", text: "High (2)",     operator: "=", value: 2 },
            ],
          },
          { name: "status",   label: "Status",      type: "set",     precedence: 30,
            setValues: ["New", "In Progress", "Done"],
          },
          { name: "assignee", label: "Assignee",    type: "string",  precedence: 40 },
          { name: "due",      label: "Due Date",    type: "date",    precedence: 50 },
          { name: "active",   label: "Active",      type: "boolean", precedence: 60 },
          { name: "score",    label: "Score",       type: "float",   precedence: 70 },
        ]}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
        hintFieldSearch={true}
        placeholder="Click inside to open hint panel…"
      />
      <pre
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
HintFieldSearch.storyName = "Hint field search";
HintFieldSearch.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates the hintFieldSearch property. When enabled, a search input appears at the top of the hint panel field column. Typing into it filters the visible fields in real time, making large field lists easy to navigate.",
    },
  },
};

// ---------------------------------------------------------------------------
// NLP resolver extension stories
// ---------------------------------------------------------------------------

// Shared fields used by the NLP extension stories
const NLP_EXT_FIELDS: FieldDefinition[] = [
  { name: "title",   label: "Title",    type: "string",  precedence: 10 },
  { name: "priority",label: "Priority", type: "integer", precedence: 20,
    hints: [
      { kind: "single", text: "critical (1)", operator: "=", value: 1 },
      { kind: "single", text: "high (2)",     operator: "=", value: 2 },
      { kind: "single", text: "low (≥4)",     operator: ">=", value: 4 },
    ],
  },
  { name: "budget",  label: "Budget ($)", type: "float",   precedence: 30 },
  { name: "revenue", label: "Revenue ($)", type: "float",   precedence: 40 },
  { name: "due",     label: "Due Date",   type: "date",    precedence: 50 },
  { name: "status",  label: "Status",    type: "set",     precedence: 60,
    setValues: ["New", "In Progress", "Blocked", "Done"],
    hints: "fieldValues",
  },
];

/** Convert a pill array to expression lines for the AI pipeline. */
function pillsToLines(pills: FilterPill[]): string {
  return pills
    .map((pill) => {
      if (pill.kind === "and") return "AND";
      if (pill.kind === "or")  return "OR";
      if (pill.kind === "open-bracket")  return "(";
      if (pill.kind === "close-bracket") return ")";
      if (pill.kind === "value")
        return `${pill.fieldName} ${pill.operator} ${String(pill.value)}`;
      if (pill.kind === "range")
        return `${pill.fieldName} from ${String(pill.from)} to ${String(pill.to)}`;
      if (pill.kind === "list")
        return `${pill.fieldName} in ${(pill.values as unknown[]).map(String).join(",")}`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Story: ValueResolver — shorthand date offsets
// ---------------------------------------------------------------------------

/**
 * Resolver that converts Nd / Nw / Nm shorthand into ISO dates on the
 * "due" field only.  Return undefined for anything else so the built-in
 * date parser handles it.
 */
const dueDateShorthandResolver: ValueResolver = {
  fieldName: "due",
  resolve: ({ rawValue }) => {
    const match = rawValue.match(/^(\d+)([dwm])$/i);
    if (!match) return undefined;
    const n = Number(match[1]);
    const unit = match[2].toLowerCase();
    const d = new Date();
    if (unit === "d") d.setDate(d.getDate() + n);
    else if (unit === "w") d.setDate(d.getDate() + n * 7);
    else if (unit === "m") d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 10);
  },
};

export const NlpDateShorthand: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");

  const runQuery = useCallback(() => {
    const resolved = resolveNlpQuery(query, NLP_EXT_FIELDS, {
      valueResolvers: [dueDateShorthandResolver],
    });
    setPills(resolved);
    setResult(
      resolved
        .map((p) =>
          p.kind === "value"
            ? `${p.fieldName} ${p.operator} ${String(p.value)}`
            : p.kind === "range"
            ? `${p.fieldName} from ${String(p.from)} to ${String(p.to)}`
            : p.kind,
        )
        .join(" | "),
    );
  }, [query]);

  const localConfig = useMemo(
    () => ({
      resolve: async (prompt: string): Promise<string> => {
        const q = prompt.match(/^Query:\s*(.+)$/m)?.[1]?.trim() ?? "";
        if (!q) return "";
        return pillsToLines(resolveNlpQuery(q, NLP_EXT_FIELDS, {
          valueResolvers: [dueDateShorthandResolver],
        }));
      },
    }),
    [],
  );

  return (
    <div style={{ maxWidth: 760, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["nlp-date-shorthand"]} />

      <p style={{ marginBottom: "0.75rem", fontSize: "0.8rem", color: "#374151" }}>
        <strong>ValueResolver:</strong> converts <code>Nd</code> / <code>Nw</code> / <code>Nm</code>{" "}
        shorthand into ISO dates on the <em>due</em> field.
        Anything that doesn't match falls through to the built-in date parser.
      </p>

      <p style={{ marginBottom: "0.5rem", fontSize: "0.8rem", color: "#6b7280" }}>
        Use the input below to try the resolver directly, or type in the AI filter box above.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runQuery()}
          placeholder="e.g. due in 3d  or  due > 2026-01-01"
          style={{
            flex: 1,
            padding: "0.4rem 0.6rem",
            fontSize: "0.8rem",
            border: "1px solid #d1d5db",
            borderRadius: 4,
          }}
        />
        <button
          onClick={runQuery}
          style={{
            padding: "0.4rem 0.9rem",
            fontSize: "0.8rem",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Resolve
        </button>
      </div>

      {result && (
        <div
          style={{
            marginBottom: "0.75rem",
            padding: "0.5rem 0.75rem",
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 4,
            fontSize: "0.8rem",
            fontFamily: "monospace",
            color: "#166534",
          }}
        >
          {result}
        </div>
      )}

      <p style={{ marginBottom: "0.5rem", fontSize: "0.8rem", color: "#6b7280" }}>
        Or try the AI filter box (same resolver wired in):
      </p>
      <AiFilter
        id="nlp-date-shorthand"
        fields={NLP_EXT_FIELDS}
        pills={pills}
        onChange={setPills}
        onClear={() => { setPills([]); setResult(""); }}
        ai={localConfig}
        aiPlaceholder="e.g. due in 3d and status is New…"
      />

      <p style={{ marginTop: "1rem", marginBottom: "0.4rem", fontSize: "0.75rem", color: "#9ca3af" }}>
        Try inputs: <code>due in 3d</code>, <code>due &gt; 2w</code>, <code>due &lt; 1m</code>,
        <code>due today</code> (built-in phrase), <code>due = 2026-06-01</code> (ISO — built-in)
      </p>
      <pre
        style={{
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
NlpDateShorthand.storyName = "NLP extension — date shorthand resolver";
NlpDateShorthand.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates a per-field ValueResolver that extends date parsing with shorthand offsets (3d, 2w, 1m). The resolver returns undefined for unrecognised input so the built-in date phrase parser handles everything else.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: ValueResolver — global numeric normaliser (currency symbols + k/M)
// ---------------------------------------------------------------------------

/**
 * Global resolver (no fieldName) that strips currency symbols and expands
 * k / M suffixes on all numeric fields.
 */
const numericNormaliser: ValueResolver = {
  resolve: ({ rawValue, field }) => {
    if (field.type !== "integer" && field.type !== "float") return undefined;
    const cleaned = rawValue.replace(/[$€£,\s]/g, "");
    const match = cleaned.match(/^([\d.]+)([km]?)$/i);
    if (!match) return undefined;
    const base = parseFloat(match[1]);
    if (isNaN(base)) return undefined;
    const suffix = match[2].toLowerCase();
    if (suffix === "k") return base * 1_000;
    if (suffix === "m") return base * 1_000_000;
    return base;
  },
};

export const NlpNumericNormaliser: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");

  const runQuery = useCallback(() => {
    const resolved = resolveNlpQuery(query, NLP_EXT_FIELDS, {
      valueResolvers: [numericNormaliser],
    });
    setPills(resolved);
    setResult(
      resolved
        .map((p) =>
          p.kind === "value"
            ? `${p.fieldName} ${p.operator} ${String(p.value)}`
            : p.kind === "range"
            ? `${p.fieldName} from ${String(p.from)} to ${String(p.to)}`
            : p.kind,
        )
        .join(" | "),
    );
  }, [query]);

  const localConfig = useMemo(
    () => ({
      resolve: async (prompt: string): Promise<string> => {
        const q = prompt.match(/^Query:\s*(.+)$/m)?.[1]?.trim() ?? "";
        if (!q) return "";
        return pillsToLines(resolveNlpQuery(q, NLP_EXT_FIELDS, {
          valueResolvers: [numericNormaliser],
        }));
      },
    }),
    [],
  );

  return (
    <div style={{ maxWidth: 760, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["nlp-numeric-normaliser"]} />

      <p style={{ marginBottom: "0.75rem", fontSize: "0.8rem", color: "#374151" }}>
        <strong>ValueResolver (global):</strong> no <code>fieldName</code> — runs for every
        field. Non-numeric fields are skipped (return <code>undefined</code>).
        Currency symbols are stripped; <code>k</code> / <code>M</code> suffixes are expanded.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runQuery()}
          placeholder="e.g. budget < $50k  or  revenue > 1.5M"
          style={{
            flex: 1,
            padding: "0.4rem 0.6rem",
            fontSize: "0.8rem",
            border: "1px solid #d1d5db",
            borderRadius: 4,
          }}
        />
        <button
          onClick={runQuery}
          style={{
            padding: "0.4rem 0.9rem",
            fontSize: "0.8rem",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Resolve
        </button>
      </div>

      {result && (
        <div
          style={{
            marginBottom: "0.75rem",
            padding: "0.5rem 0.75rem",
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 4,
            fontSize: "0.8rem",
            fontFamily: "monospace",
            color: "#166534",
          }}
        >
          {result}
        </div>
      )}

      <p style={{ marginBottom: "0.5rem", fontSize: "0.8rem", color: "#6b7280" }}>
        Or try the AI filter box:
      </p>
      <AiFilter
        id="nlp-numeric-normaliser"
        fields={NLP_EXT_FIELDS}
        pills={pills}
        onChange={setPills}
        onClear={() => { setPills([]); setResult(""); }}
        ai={localConfig}
        aiPlaceholder="e.g. budget < $50k and revenue > 1.5M…"
      />

      <p style={{ marginTop: "1rem", marginBottom: "0.4rem", fontSize: "0.75rem", color: "#9ca3af" }}>
        Try: <code>budget &lt; $50k</code>, <code>revenue &gt; 1.5M</code>,
        <code>priority &gt; 2</code> (plain integer, built-in),
        <code>title contains bug</code> (string — normaliser skips it)
      </p>
      <pre
        style={{
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
NlpNumericNormaliser.storyName = "NLP extension — numeric normaliser";
NlpNumericNormaliser.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates a global ValueResolver (no fieldName) that strips currency symbols and expands k/M suffixes on all numeric fields. Non-numeric fields receive undefined and fall through to built-in parsers, so string and set fields are completely unaffected.",
    },
  },
};

// ---------------------------------------------------------------------------
// Story: ValueResolver chain — date shorthand + numeric normaliser combined
// ---------------------------------------------------------------------------

export const NlpResolverChain: Story = () => {
  const [pills, setPills] = useState<FilterPill[]>([]);
  const [query, setQuery] = useState("");
  const [resolverLog, setResolverLog] = useState<string[]>([]);

  // Instrumented versions that log which resolver handled each value
  const loggingDateResolver: ValueResolver = useMemo(
    () => ({
      fieldName: "due",
      resolve: ({ rawValue }) => {
        const match = rawValue.match(/^(\d+)([dwm])$/i);
        if (!match) return undefined;
        const n = Number(match[1]);
        const unit = match[2].toLowerCase();
        const d = new Date();
        if (unit === "d") d.setDate(d.getDate() + n);
        else if (unit === "w") d.setDate(d.getDate() + n * 7);
        else if (unit === "m") d.setMonth(d.getMonth() + n);
        const iso = d.toISOString().slice(0, 10);
        setResolverLog((log) => [...log, `date-shorthand: "${rawValue}" → "${iso}"   (due field)`]);
        return iso;
      },
    }),
    [],
  );

  const loggingNumericResolver: ValueResolver = useMemo(
    () => ({
      resolve: ({ rawValue, field }) => {
        if (field.type !== "integer" && field.type !== "float") return undefined;
        const cleaned = rawValue.replace(/[$€£,\s]/g, "");
        const match = cleaned.match(/^([\d.]+)([km]?)$/i);
        if (!match) return undefined;
        const base = parseFloat(match[1]);
        if (isNaN(base)) return undefined;
        const suffix = match[2].toLowerCase();
        const value = suffix === "k" ? base * 1_000 : suffix === "m" ? base * 1_000_000 : base;
        setResolverLog((log) => [...log, `numeric-normaliser: "${rawValue}" → ${value}   (${field.name} field)`]);
        return value;
      },
    }),
    [],
  );

  const resolvers = useMemo(
    () => [loggingDateResolver, loggingNumericResolver],
    [loggingDateResolver, loggingNumericResolver],
  );

  const runQuery = useCallback(() => {
    setResolverLog([]);
    const resolved = resolveNlpQuery(query, NLP_EXT_FIELDS, { valueResolvers: resolvers });
    setPills(resolved);
  }, [query, resolvers]);

  const localConfig = useMemo(
    () => ({
      resolve: async (prompt: string): Promise<string> => {
        const q = prompt.match(/^Query:\s*(.+)$/m)?.[1]?.trim() ?? "";
        if (!q) return "";
        setResolverLog([]);
        return pillsToLines(resolveNlpQuery(q, NLP_EXT_FIELDS, { valueResolvers: resolvers }));
      },
    }),
    [resolvers],
  );

  return (
    <div style={{ maxWidth: 760, padding: "1.5rem" }}>
      <StoryExplanation text={STORY_EXPLANATIONS["nlp-resolver-chain"]} />

      <p style={{ marginBottom: "0.75rem", fontSize: "0.8rem", color: "#374151" }}>
        <strong>Resolver chain:</strong> <code>[dueDateShorthand, numericNormaliser]</code>.
        The first resolver to return a non-<code>undefined</code> value wins.
        A resolver log below shows which one handled each value.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runQuery()}
          placeholder="e.g. due in 2w and budget < $50k and priority > 2"
          style={{
            flex: 1,
            padding: "0.4rem 0.6rem",
            fontSize: "0.8rem",
            border: "1px solid #d1d5db",
            borderRadius: 4,
          }}
        />
        <button
          onClick={runQuery}
          style={{
            padding: "0.4rem 0.9rem",
            fontSize: "0.8rem",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Resolve
        </button>
      </div>

      {resolverLog.length > 0 && (
        <div
          style={{
            marginBottom: "0.75rem",
            padding: "0.5rem 0.75rem",
            background: "#fff7ed",
            border: "1px solid #fdba74",
            borderRadius: 4,
            fontSize: "0.78rem",
            fontFamily: "monospace",
            color: "#9a3412",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.3rem", fontFamily: "sans-serif" }}>Resolver log</div>
          {resolverLog.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))}
        </div>
      )}

      <p style={{ marginBottom: "0.5rem", fontSize: "0.8rem", color: "#6b7280" }}>
        Or use the AI filter box (same resolver chain):
      </p>
      <AiFilter
        id="nlp-resolver-chain"
        fields={NLP_EXT_FIELDS}
        pills={pills}
        onChange={setPills}
        onClear={() => { setPills([]); setResolverLog([]); }}
        ai={localConfig}
        aiPlaceholder="e.g. due in 2w and budget < $50k and priority > 2…"
      />

      <p style={{ marginTop: "1rem", marginBottom: "0.4rem", fontSize: "0.75rem", color: "#9ca3af" }}>
        Try: <code>due in 2w and budget &lt; $50k and priority &gt; 2</code>
        &nbsp;·&nbsp; <code>due today and revenue &gt; 1.5M</code>
        &nbsp;·&nbsp; <code>title contains login</code> (neither resolver fires)
      </p>
      <pre
        style={{
          padding: "0.75rem",
          background: "#f4f6f9",
          border: "1px solid #dde3ed",
          borderRadius: 4,
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(pills, null, 2)}
      </pre>
    </div>
  );
};
NlpResolverChain.storyName = "NLP extension — resolver chain";
NlpResolverChain.parameters = {
  docs: {
    description: {
      story:
        "Demonstrates chaining two ValueResolvers. The date-shorthand resolver runs first and handles Nd/Nw/Nm on the due field; the numeric normaliser runs next and expands currency symbols and k/M suffixes on all numeric fields. A live resolver log shows which resolver handled each value in real time.",
    },
  },
};

