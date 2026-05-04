import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { AiFilter, resolveNlpExpression, resolveNlpQuery, type AiConfig, type FieldDefinition, type FilterPill, type ValueResolver } from "./lib";
import type { AiFilterProps } from "./lib";
import "./styles/global.css";

// ---------------------------------------------------------------------------
// Custom value resolvers — extend NLP parsing for specific fields
// ---------------------------------------------------------------------------

/** Parse "3m" shorthand for the "due" field (3 months from now). */
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

// Pre-loaded set values for value-only inference (e.g. "done" → state = Done).
// Needed when setValues is async and can't be introspected synchronously.
const SET_VALUES_BY_FIELD: Record<string, string[]> = {
  state: ["New", "In Progress", "Blocked", "Done"],
};

function App(): JSX.Element {
  const [pills, setPills] = useState<FilterPill[]>([]);
  const [nlpInput, setNlpInput] = useState("");
  const [nlpResult, setNlpResult] = useState<FilterPill | undefined>();
  const [colorScheme, setColorScheme] = useState<AiFilterProps["colorScheme"]>("auto");

  function cycleTheme(): void {
    setColorScheme((prev) =>
      prev === "auto" ? "light" : prev === "light" ? "dark" : "auto",
    );
  }

  const fields = useMemo<FieldDefinition[]>(
    () => [
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
          { kind: "single", text: "critical", operator: "=", value: 1 },
          { kind: "range", text: "top 3", from: 1, to: 3 },
        ],
      },
      {
        name: "cost",
        label: "Cost",
        type: "float",
        precedence: 40,
        hints: [{ kind: "range", text: "mid range", from: 10.5, to: 88.25 }],
      },
      {
        name: "active",
        label: "Active",
        type: "boolean",
        precedence: 30,
      },
      {
        name: "due",
        label: "Due Date",
        type: "date",
        precedence: 70,
        translate: (text) => {
          const match = text.match(/^(\d+)m$/i);
          if (!match) return text;
          const dt = new Date();
          dt.setMonth(dt.getMonth() + Number(match[1]));
          return dt.toISOString();
        },
      },
      {
        name: "state",
        label: "State",
        type: "set",
        precedence: 100,
        setValues: async () => ["New", "In Progress", "Blocked", "Done"],
        hints: "fieldValues",
      },
      {
        name: "window",
        label: "Window",
        type: "custom",
        precedence: 85,
        operators: ["=", "!", "within"],
        translate: (text) => {
          const match = text.match(/^(\d+)d$/i);
          if (!match) return text;
          const now = Date.now();
          return new Date(now + Number(match[1]) * 24 * 3600 * 1000).toISOString();
        },
      },
    ],
    [],
  );

  // NLP-based resolver — no LLM required. Extracts the query from the built
  // prompt, splits on AND/OR/commas, and resolves each clause directly.
  const aiConfig = useMemo<AiConfig>(
    () => ({
      resolve: async (prompt: string): Promise<string> => {
        const queryMatch = prompt.match(/^Query:\s*(.+)$/m);
        const query = queryMatch?.[1]?.trim() ?? "";
        if (!query) return "";

        const pills = resolveNlpQuery(query, fields, {
          valueResolvers: VALUE_RESOLVERS,
          setValuesByField: SET_VALUES_BY_FIELD,
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
      },
    }),
    [fields],
  );

  return (
    <div className="demo-wrap" data-color-scheme={colorScheme}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Easy Filter</h1>
        <button
          type="button"
          onClick={cycleTheme}
          style={{ padding: "0.3rem 0.8rem", borderRadius: 4, cursor: "pointer",
                   border: "1px solid var(--ef-border)", background: "var(--ef-surface)",
                   color: "var(--ef-text)", fontSize: "0.82rem" }}
        >
          Theme: {colorScheme}
        </button>
      </div>
      <p>
        Enter examples like: <strong>state = Done</strong>, <strong>priority 1 to 3</strong>, <strong>AND</strong>,
        <strong> (</strong>, <strong>window within 7d</strong>.
      </p>
      <AiFilter
        id="demo-filter"
        fields={fields}
        pills={pills}
        onChange={setPills}
        onClear={() => {
          setPills([]);
        }}
        ai={aiConfig}
        colorScheme={colorScheme}
      />
      <div className="demo-log">{JSON.stringify(pills, null, 2)}</div>

      <h2>NLP Resolver demo</h2>
      <p>Type a natural-language expression to resolve it directly (no LLM needed).</p>
      <input
        style={{ width: "100%", padding: "6px 8px", marginBottom: 8 }}
        placeholder='e.g. "cost greater than 10" or "due last week" or "state one of Done, Blocked"'
        value={nlpInput}
        onChange={(e) => {
          const val = e.target.value;
          setNlpInput(val);
          setNlpResult(resolveNlpExpression(val, fields, { valueResolvers: VALUE_RESOLVERS, setValuesByField: SET_VALUES_BY_FIELD }));
        }}
      />
      <div className="demo-log">{JSON.stringify(nlpResult, null, 2)}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
