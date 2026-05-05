# ai-filter

`ai-filter` is a React filter-builder that converts typed input, hint clicks, and optional NLP/AI input into a typed array of filter pills.

It is designed for applications that need:

- free-form filter entry
- structured filter data
- keyboard-first interaction
- clickable hints and suggestions
- optional natural-language parsing
- optional async set-value lookup

The component does not execute your filters. It builds and edits a `FilterPill[]` model that your app can store, serialize, validate, and send to your backend.

## Installation

```bash
npm install ai-filter
```

Peer dependencies:

- `react >= 18`
- `react-dom >= 18`

Import the component and bundled styles:

```tsx
import { AiFilter } from "ai-filter";
import "ai-filter/dist/style.css";
```

If you do not need NLP helper exports, use the smaller core entrypoint:

```tsx
import { AiFilter } from "ai-filter/core";
import "ai-filter/dist/style.css";
```

## Quick start

```tsx
import { useState } from "react";
import { AiFilter } from "ai-filter";
import type { FieldDefinition, FilterPill } from "ai-filter";
import "ai-filter/dist/style.css";

const fields: FieldDefinition[] = [
  {
    name: "title",
    label: "Title",
    type: "string",
    precedence: 90,
  },
  {
    name: "priority",
    label: "Priority",
    type: "integer",
    precedence: 80,
  },
  {
    name: "status",
    label: "Status",
    type: "set",
    precedence: 100,
    setValues: ["New", "In Progress", "Done"],
    hints: "fieldValues",
  },
];

export function App(): JSX.Element {
  const [pills, setPills] = useState<FilterPill[]>([]);

  return (
    <AiFilter
      id="issues-filter"
      fields={fields}
      pills={pills}
      onChange={setPills}
      onClear={() => setPills([])}
      placeholder="Filter issues..."
    />
  );
}
```

## How to set up a filter

The minimum setup is:

1. Define your fields.
2. Keep `FilterPill[]` state in your app.
3. Pass `fields`, `pills`, and `onChange` to `AiFilter`.
4. Render results using the returned pill model.

Recommended setup pattern:

```tsx
import { useMemo, useState } from "react";
import { AiFilter } from "ai-filter";
import type { FieldDefinition, FilterPill } from "ai-filter";

export function ProductsPage(): JSX.Element {
  const [pills, setPills] = useState<FilterPill[]>([]);

  const fields = useMemo<FieldDefinition[]>(
    () => [
      { name: "name", type: "string", precedence: 100, label: "Name" },
      { name: "price", type: "float", precedence: 80, label: "Price" },
      { name: "active", type: "boolean", precedence: 70, label: "Active" },
      {
        name: "category",
        type: "set",
        precedence: 90,
        label: "Category",
        setValues: ["Books", "Electronics", "Food"],
        hints: "fieldValues",
      },
    ],
    [],
  );

  return (
    <AiFilter
      id="products"
      fields={fields}
      pills={pills}
      onChange={setPills}
      onClear={() => setPills([])}
    />
  );
}
```

Notes:

- controlled usage is the recommended mode
- `id` is optional, but recommended if you want recent values persisted in `localStorage`
- `precedence` affects both UI suggestion order and some NLP fallback behavior

## Component API

### `AiFilter` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | `undefined` | Storage key suffix for recent values. When provided, recently used values are persisted in `localStorage`. |
| `fields` | `FieldDefinition[]` | `[]` | Optional explicit fields. When used with `agGrid`, these fields merge by `name` and override generated AG Grid fields with the same name. |
| `agGrid` | `AgGridApi` | `undefined` | Optional AG Grid API instance. When provided, fields are generated from AG Grid columns (`field` -> `name`, `headerName` -> `label`, `cellDataType` -> `type`). `agSetColumnFilter` forces field type `set`. |
| `pills` | `FilterPill[]` | `[]` | Current pill array. Use this for controlled state. |
| `onChange` | `(pills: FilterPill[]) => void` | `undefined` | Called whenever pills are added, edited, deleted, pasted, or reordered. Receives the full next array. |
| `onFilterChange` | `(event: FilterChangeEvent) => void` | `undefined` | Fired when AG Grid external filter callbacks are rebuilt from pills (when `agGrid` is supplied). |
| `onClear` | `() => void` | `undefined` | Called when the clear button is clicked. Useful for resetting external state. |
| `hintsEnabled` | `boolean` | `true` | Enables or disables the hint panel entirely. |
| `className` | `string` | `undefined` | Extra CSS class for the root element. |
| `placeholder` | `string` | `"Type a filter..."` | Placeholder shown in the main text input. |
| `ai` | `AiConfig \| false` | `false` | Enables AI/NLP mode. When provided, the component starts in AI mode and calls `ai.resolve(prompt)` to turn plain-English text into filter expressions. |
| `colorScheme` | `"light" \| "dark" \| "auto"` | `"auto"` | Visual color mode. `auto` follows system preference. |
| `matchDropdownMaxHeight` | `string` | `"12rem"` | CSS height value for the match/suggestion dropdown. |
| `suggestionsDropdownSticky` | `boolean` | `false` | Keeps the match dropdown sticky while scrolling inside its container. |
| `hintPanelMaxHeight` | `string` | `"15rem"` | CSS height value for the hint panel body. |
| `hintColumns` | `number` | `1` | Number of columns used when rendering hint items. |
| `pillMaxWidth` | `string` | `undefined` | Maximum width of each rendered pill. Long text is truncated with ellipsis when set. |

When `agGrid` is supplied:

- generated field hints are loaded from grid row values when the hint panel is shown
- generated `set` fields use `filterParams.values` when it is a static array, otherwise values are collected from grid rows
- user-provided `fields` with the same `name` override generated field definitions

### `AiConfig`

```ts
type AiConfig = {
  resolve: (prompt: string) => Promise<string>;
};
```

`resolve` receives a prompt built from your field definitions and should return text containing one filter expression per line.

Example:

```tsx
<AiFilter
  fields={fields}
  pills={pills}
  onChange={setPills}
  ai={{
    resolve: async (prompt) => {
      const response = await fetch("/api/filter-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      return data.text;
    },
  }}
/>
```

## Field definitions

`FieldDefinition` is a discriminated union. Every field has shared base properties, then type-specific properties.

### Shared field properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | yes | Stable machine name used in pill data, input parsing, NLP resolution, and renderer callbacks. |
| `label` | `string` | no | Human-readable label shown in the UI. Falls back to `name`. |
| `type` | `FieldType` | yes | Field data type. Controls default operators, validation, parsing, matching, and editor behavior. |
| `precedence` | `number` | yes | Ranking value used by suggestions and some NLP fallback logic. Higher values rank earlier in matching UI; lower values are preferred by some NLP fallbacks. |
| `maxInstances` | `number` | no | Maximum number of pills that may be created for this field. Once reached, the field stops appearing as an available suggestion. |
| `hints` | `HintSource` | no | Hint source for the hint panel. Can be a static array, async function, or `"fieldValues"` for set fields. |
| `hintsDebounceMs` | `number` | no | Debounce time for async hint functions. Ignored for static arrays and `"fieldValues"`. |
| `editor` | `(props: CustomEditorProps) => ReactNode` | no | Replaces the built-in inline pill editor for that field. |
| `renderers` | `FieldRenderers` | no | Overrides rendering of hint rows, match rows, and pill content for this field. |

### Standard field properties

Standard fields are `string`, `integer`, `float`, `boolean`, `date`, and `datetime`.

| Property | Type | Applies to | Description |
| --- | --- | --- | --- |
| `translate` | `(text: string) => unknown` | standard fields | Custom conversion from raw text to stored pill value. Useful for shorthand like `2w`, `tomorrow`, or domain-specific tokens. |
| `operators` | `AnyOperator[]` | standard fields | Overrides the default operator list for the field. |
| `dateFormat` | `string` | `date`, `datetime` | Custom display/input format used for date formatting. |

### Set field properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `setValues` | `string[] \| ((lookupText: string) => Promise<string[]>) \| (() => Promise<string[]>)` | no | Allowed set values. Can be static or async. |
| `setValuesDebounceMs` | `number` | no | Debounce used before calling an async `setValues` source. |
| `operators` | `AnyOperator[]` | no | Optional operator override. Defaults to set operators. |

### Custom field properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `translate` | `(text: string) => unknown` | yes | Converts raw input into your custom stored value. |
| `operators` | `AnyOperator[]` | yes | Complete operator list for the field. Custom fields must define their own operators. |

## Field types

| Field type | Stored value | Default operators | Notes |
| --- | --- | --- | --- |
| `string` | `string` | `=` `!` `*` `!*` `<*` `>*` | `*` means contains, `<*` starts with, `>*` ends with. |
| `integer` | `number` | `=` `!` `>` `<` `>=` `<=` | Integer-only parsing and validation. |
| `float` | `number` | `=` `!` `>` `<` `>=` `<=` | Decimal parsing and validation. |
| `boolean` | `boolean` | `=` `!` | Accepts values like `true`, `false`, `yes`, `no`, `1`, `0`. |
| `date` | ISO date string | `=` `!` `>` `<` `>=` `<=` | NLP can resolve phrases like `today` and `last week`. |
| `datetime` | ISO datetime string | `=` `!` `>` `<` `>=` `<=` | Same as `date`, but with datetime resolution. |
| `set` | `string` | `=` `!` `in` | Values come from `setValues`; free-text value candidates are not used. |
| `custom` | `unknown` | custom | You provide both parsing and operators. |

## Data types

### `FilterPill`

`FilterPill` is the core output model returned by `onChange` and NLP helpers.

```ts
type FilterPill =
  | AndPill
  | OrPill
  | OpenBracketPill
  | CloseBracketPill
  | ValuePill
  | ListPill
  | RangePill;
```

#### Logical pills

| Type | Shape | Description |
| --- | --- | --- |
| `AndPill` | `{ id, kind: "and", invalid? }` | Logical AND token between clauses. |
| `OrPill` | `{ id, kind: "or", invalid? }` | Logical OR token between clauses. |
| `OpenBracketPill` | `{ id, kind: "open-bracket", invalid? }` | Opening bracket token. |
| `CloseBracketPill` | `{ id, kind: "close-bracket", invalid? }` | Closing bracket token. |

#### Value pills

| Type | Shape | Description |
| --- | --- | --- |
| `ValuePill` | `{ id, kind: "value", fieldName, operator, value, invalid? }` | Single-value clause such as `priority >= 3`. |
| `ListPill` | `{ id, kind: "list", fieldName, operator, values, invalid? }` | Multi-value clause such as `status in ["New", "Done"]`. |
| `RangePill` | `{ id, kind: "range", fieldName, from, to, invalid? }` | Range clause such as `price 10 to 20`. |

### `Hint`

```ts
type Hint = HintSingle | HintList | HintRange;
```

| Hint type | Shape | Description |
| --- | --- | --- |
| `HintSingle` | `{ kind: "single", text, operator, value }` | One-click creation of a single-value pill. |
| `HintList` | `{ kind: "list", text, operator, values }` | One-click creation of a list pill. |
| `HintRange` | `{ kind: "range", text, from, to }` | One-click creation of a range pill. |

### `FieldRenderers`

```ts
type FieldRenderers = {
  hint?: (input: FieldRendererInput) => ReactNode;
  match?: (input: FieldRendererInput) => ReactNode;
  pill?: (input: FieldRendererInput) => ReactNode;
};
```

Use these to customize presentation without changing the underlying data model.

### `FieldRendererInput`

| Property | Type | Description |
| --- | --- | --- |
| `defaultText` | `string` | The default text generated by AiFilter. |
| `value` | `unknown` | Single value when relevant. |
| `values` | `unknown[]` | Multiple values when relevant. |
| `hint` | `Hint` | Hint payload for hint rendering. |
| `suggestion` | `FieldMatch` | Match-dropdown payload for suggestion rendering. |
| `pill` | `ValuePill \| ListPill \| RangePill` | Pill payload for pill rendering. |

### `CustomEditorProps`

| Property | Type | Description |
| --- | --- | --- |
| `value` | `string` | Current editable value as text. |
| `onChange` | `(next: string) => void` | Update the local editor value. |
| `onCommit` | `() => void` | Commit the current editor value. |
| `onCancel` | `() => void` | Cancel editing. |

## Set fields and async lookup

Set fields can be static or async.

### Static set field

```ts
{
  name: "status",
  type: "set",
  precedence: 100,
  setValues: ["New", "Done"],
  hints: "fieldValues",
}
```

### Async set field

```ts
{
  name: "category",
  type: "set",
  precedence: 100,
  setValuesDebounceMs: 300,
  setValues: async (lookupText) => {
    const response = await fetch(`/api/categories?q=${encodeURIComponent(lookupText)}`);
    return response.json();
  },
  hints: "fieldValues",
}
```

How async set lookup works:

- static arrays are available immediately
- async sources are called from user lookup input, not eager preloaded on mount
- lookup calls are debounced per field using `setValuesDebounceMs`
- older async responses are ignored when a newer request for the same field finishes later
- when editing a set pill, typing in the pill editor also triggers async lookup
- for global free-text matching, set-field lookups can be used to surface matching set values across fields

## Hints

Hints power the hint panel shown below the filter.

### `hints` property

`hints` accepts three shapes:

```ts
type HintSource = Hint[] | (() => Promise<Hint[]>) | "fieldValues";
```

### Static hints example

```ts
{
  name: "priority",
  type: "integer",
  precedence: 80,
  hints: [
    { kind: "single", text: "Critical", operator: "=", value: 1 },
    { kind: "single", text: "High", operator: "=", value: 2 },
    { kind: "range", text: "Top 3", from: 1, to: 3 },
  ],
}
```

### Async hints example

```ts
{
  name: "assignee",
  type: "string",
  precedence: 75,
  hintsDebounceMs: 400,
  hints: async () => {
    const response = await fetch("/api/saved-people-hints");
    return response.json();
  },
}
```

### `"fieldValues"` hints example

```ts
{
  name: "status",
  type: "set",
  precedence: 100,
  setValues: ["New", "Done", "Blocked"],
  hints: "fieldValues",
}
```

How hints work:

- the hint panel is field-aware
- when a field is active, only that field's hints are shown
- when a pill is selected, the panel locks to that pill's field where appropriate
- async hint functions are debounced if `hintsDebounceMs` is set
- `"fieldValues"` generates hint rows from set values
- async set-value results are synchronized into `"fieldValues"` hints so the panel updates after lookup completes
- recent values are also shown and deduplicated against hints

## How matching works

The match dropdown is generated from the current input.

There are two main matching modes.

### 1. Prefixed matching

If the input starts with a recognized field name, AiFilter treats the rest of the input as a field-specific clause.

Examples:

- `status done`
- `status = done`
- `title bug`
- `priority > 3`

Behavior:

- AiFilter identifies the field prefix
- it extracts any leading operator from the remaining text
- it searches that field's hints first
- for set fields, if there are no hints it searches loaded set values
- for non-set fields, if nothing else matches and the value is plausible for that type, it offers a `value-candidate`

### 2. Global matching

If there is no field prefix, AiFilter searches across all available fields.

Behavior:

- field-name and label matches are offered as `field` suggestions
- if the user typed a leading operator like `> 10`, only fields that support that operator are considered
- set fields search their loaded values or generated hints
- non-set fields can produce free-text `value-candidate` suggestions when the input looks plausible for their type
- results are deduplicated and sorted by precedence, then by field type and text

### Match ranking summary

Higher-ranked results appear first.

- field matches rank from field precedence
- set values get a small bonus over generic value candidates
- hints rank above plain value candidates
- `maxInstances` removes exhausted fields from available suggestions

## Operators

Default operators by type:

- `string`: `=` `!` `*` `!*` `<*` `>*`
- `integer`, `float`, `date`, `datetime`: `=` `!` `>` `<` `>=` `<=`
- `boolean`: `=` `!`
- `set`: `=` `!` `in`

Meaning of string operators:

- `*` contains
- `!*` does not contain
- `<*` starts with
- `>*` ends with

`in` is used for list-style set membership.

You can override operators per field.

## Natural language processing (NLP)

The package exports:

- `resolveNlpExpression`
- `resolveNlpQuery`
- `resolveOperatorAlias`
- `resolveDatePhrase`
- NLP types: `NlpResolveOptions`, `ValueResolver`, `ValueResolverContext`, `DateResolution`

### `resolveNlpExpression`

Resolves a single clause into one `FilterPill`.

```ts
import { resolveNlpExpression } from "ai-filter";

const pill = resolveNlpExpression("status one of New, Done", fields);
```

Examples it supports:

| Input | Result |
| --- | --- |
| `cost > 10` | `ValuePill { fieldName: "cost", operator: ">", value: 10 }` |
| `cost greater than 10` | same (word-alias for `>`) |
| `status is active` | `ValuePill { fieldName: "status", operator: "=", value: "active" }` |
| `created last week` | `RangePill { fieldName: "created", from: …, to: … }` |
| `name contains smith` | `ValuePill { fieldName: "name", operator: "*", value: "smith" }` |
| `price between 10 and 50` | `RangePill { fieldName: "price", from: 10, to: 50 }` |
| `category one of Books, Food` | `ListPill { fieldName: "category", operator: "in", values: ["Books","Food"] }` |
| `AND` / `OR` / `(` / `)` | logical connector pills |

### `resolveNlpQuery`

Resolves a full multi-clause query into `FilterPill[]`.

```ts
import { resolveNlpQuery } from "ai-filter";

const pills = resolveNlpQuery(
  "(status = Done or status = Blocked) and priority >= 3",
  fields,
);
```

Supported features:

- `and` / `or` connectors (case-insensitive)
- brackets `(` and `)` for grouping
- comma-separated clauses treated as implicit `AND`
- range phrases: `between X and Y`, `from X to Y`
- list phrases: `one of A, B, C`, `in A, B, C`
- **context carry-over** for non-list fields: bare values after `or` or `,` inherit the preceding field and operator

  ```
  "title is foo or bar"      → title=foo OR title=bar
  "title is foo, bar, baz"   → title=foo OR title=bar OR title=baz
  "count > 5 or 10"          → count>5  OR count>10
  ```

### `NlpResolveOptions`

| Property | Type | Description |
| --- | --- | --- |
| `valueResolvers` | `ValueResolver[]` | Custom value parsers tried before built-in parsing. |
| `fallbackToHighestPrecedence` | `boolean` | When no field token matches, choose the highest-precedence field as fallback. Defaults to `true`. |
| `setValuesByField` | `Record<string, string[]>` | Pre-loaded set values for field inference and set-value validation when `setValues` is async. |

---

## Extending the NLP resolver

### Overview

The NLP resolver uses a `valueResolvers` extension point — an ordered list of custom parsers that run **before** the built-in type parsers. Return the parsed value (or `undefined` to fall through to the next resolver in the chain).

```ts
type ValueResolver = {
  fieldName?: string;  // omit to match all fields
  resolve: (ctx: ValueResolverContext) => unknown | undefined;
};

type ValueResolverContext = {
  field: FieldDefinition;
  rawValue: string;   // the raw text from the input
  operator: AnyOperator;
};
```

Extensions are passed via `NlpResolveOptions`:

```ts
resolveNlpQuery(query, fields, { valueResolvers: [myResolver] });
```

When wired through `ai.resolve`, pass them from inside your resolver function:

```ts
const ai: AiConfig = {
  resolve: async (prompt) => {
    const query = extractQueryFromPrompt(prompt);
    const pills = resolveNlpQuery(query, fields, {
      valueResolvers: [myResolver],
    });
    return pillsToExpressionLines(pills);
  },
};
```

---

### Extension example 1 — shorthand date offsets

Accept `Nd` / `Nw` / `Nm` shorthand on date fields (`3d` = 3 days from now, `2w` = 2 weeks, `1m` = 1 month).

```ts
import { resolveNlpExpression, type ValueResolver } from "ai-filter";

const dueDateResolver: ValueResolver = {
  fieldName: "due",  // only runs for the "due" field
  resolve: ({ rawValue }) => {
    const match = rawValue.match(/^(\d+)([dwm])$/i);
    if (!match) return undefined;  // fall through to built-in parser

    const n = Number(match[1]);
    const unit = match[2].toLowerCase();
    const d = new Date();
    if (unit === "d") d.setDate(d.getDate() + n);
    else if (unit === "w") d.setDate(d.getDate() + n * 7);
    else if (unit === "m") d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 10);  // return an ISO date string
  },
};

// "due in 3d" → ValuePill { fieldName: "due", operator: "=", value: "2026-05-08" }
const pill = resolveNlpExpression("due in 3d", fields, {
  valueResolvers: [dueDateResolver],
});
```

**How it works:**

1. `resolveNlpExpression` tokenises the input to `{ fieldToken: "due", operatorToken: "in", valueToken: "3d" }`.
2. Before the built-in date parser runs, `dueDateResolver.resolve` is called with `rawValue = "3d"`.
3. The regex matches and returns an ISO date string — the built-in is skipped.
4. Return `undefined` for anything that doesn't match and the built-in parser handles it normally.

---

### Extension example 2 — currency codes

A `price` field that accepts `USD`, `EUR`, `GBP` as stand-ins for numeric ranges.

```ts
const CURRENCY_RANGES: Record<string, [number, number]> = {
  usd: [0, 100],
  eur: [0, 85],
  gbp: [0, 75],
};

const priceRangeResolver: ValueResolver = {
  fieldName: "price",
  resolve: ({ rawValue, field, operator }) => {
    // Only handle when the operator implies equality / unknown context
    if (operator !== "=" && operator !== "*") return undefined;
    const range = CURRENCY_RANGES[rawValue.toLowerCase()];
    if (!range) return undefined;
    // Returning an object here makes the pill's value an object —
    // a real implementation would return a RangePill from a helper instead.
    // For demonstration, return the lower bound as a number:
    return range[0];
  },
};
```

---

### Extension example 3 — global unit normalisation

Strip currency symbols and convert `k` / `M` suffixes for **all** numeric fields (no `fieldName` specified = runs for every field).

```ts
import { type ValueResolver } from "ai-filter";

const numericNormalizer: ValueResolver = {
  // No fieldName — runs for every field before built-in parsers
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

// "revenue > $1.5M" → ValuePill { fieldName: "revenue", operator: ">", value: 1500000 }
// "budget < 50k"    → ValuePill { fieldName: "budget",  operator: "<", value: 50000 }
const pills = resolveNlpQuery("revenue > $1.5M and budget < 50k", fields, {
  valueResolvers: [numericNormalizer],
});
```

**How it works:**

- Because no `fieldName` is set, `numericNormalizer.resolve` is invoked for every field, but it immediately returns `undefined` when the field type isn't numeric — so non-numeric fields are unaffected.
- The resolver strips symbols, parses the base number, and multiplies by the scale suffix.
- Returning a `number` short-circuits the built-in parser for that field.

---

### Extension example 4 — multiple resolvers in order

Resolvers are tried in the order they appear in the array; the first to return a non-`undefined` value wins.

```ts
const pills = resolveNlpQuery(query, fields, {
  valueResolvers: [
    dueDateResolver,      // runs first — handles "3d", "2w", "1m" on "due"
    numericNormalizer,    // runs next  — strips currency symbols on numeric fields
    // built-in parsers run last automatically
  ],
});
```

---

### Using `resolveOperatorAlias`

Converts a text alias to its canonical symbol operator — useful for building your own parsers or validating user input before constructing a pill manually.

```ts
import { resolveOperatorAlias } from "ai-filter";

resolveOperatorAlias("greater than")  // → ">"
resolveOperatorAlias("contains")      // → "*"
resolveOperatorAlias("not one of")    // → "!"
resolveOperatorAlias(">=")            // → ">="
resolveOperatorAlias("unknown")       // → undefined
```

---

### Using `resolveDatePhrase`

Converts a natural-language date phrase to an ISO string (and optional range end). Useful in custom resolvers or for pre-processing user input.

```ts
import { resolveDatePhrase } from "ai-filter";

resolveDatePhrase("today")       // → { value: "2026-05-05" }
resolveDatePhrase("last week")   // → { value: "2026-04-27", rangeEnd: "2026-05-03" }
resolveDatePhrase("next month")  // → { value: "2026-06-01", rangeEnd: "2026-06-30" }
resolveDatePhrase("2026-03-15")  // → undefined  (not a phrase — handled by built-in)

// Pass forDatetime=true to get full datetime strings
resolveDatePhrase("yesterday", true)
// → { value: "2026-05-04 00:00:00", rangeEnd: "2026-05-04 23:59:59" }
```

When `rangeEnd` is present, the resolver may produce a `RangePill` instead of a `ValuePill`.

---

### NLP quick-reference

#### Basic expressions

```ts
resolveNlpExpression("priority greater than 3", fields);
resolveNlpExpression("title contains login", fields);
resolveNlpExpression("status in New, Done", fields);
```

#### Date expressions

```ts
resolveNlpExpression("created today", fields);
resolveNlpExpression("created last week", fields);
resolveNlpExpression("due between 2026-05-01 and 2026-05-31", fields);
```

#### Query expressions

```ts
resolveNlpQuery("status = Done and priority >= 2", fields);
resolveNlpQuery("(status = New or status = Blocked) and assignee contains sam", fields);
resolveNlpQuery("price between 10 and 20, category one of Books, Food", fields);
// Context carry-over (non-list fields):
resolveNlpQuery("title is foo or bar", fields);     // title=foo OR title=bar
resolveNlpQuery("count > 5 or 10", fields);         // count>5 OR count>10
resolveNlpQuery("title is foo, bar, baz", fields);  // title=foo OR title=bar OR title=baz
```

---

### AI mode and NLP

When `ai.resolve()` is provided, the component:

1. Builds a structured prompt from your field definitions and currently known set values.
2. Sends that prompt to your resolver function.
3. Parses each returned line with `resolveNlpExpression`.
4. Inserts the resulting pills into the filter.

Your AI backend should return plain filter expressions — one per line — not JSON.

```txt
status = Done
priority >= 3
title * login
```

To use a local NLP resolver as the AI backend (no network required):

```ts
import { resolveNlpQuery, type AiConfig } from "ai-filter";

const ai: AiConfig = {
  resolve: async (prompt: string): Promise<string> => {
    // The prompt ends with "Query: <user text>"
    const query = prompt.match(/^Query:\s*(.+)$/m)?.[1]?.trim() ?? "";
    if (!query) return "";

    const pills = resolveNlpQuery(query, fields, {
      valueResolvers: [dueDateResolver, numericNormalizer],
    });

    return pills
      .map((pill) => {
        if (pill.kind === "and") return "AND";
        if (pill.kind === "or") return "OR";
        if (pill.kind === "open-bracket") return "(";
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
  },
};

<AiFilter fields={fields} pills={pills} onChange={setPills} ai={ai} />
```

## Custom rendering and custom editors

### Custom renderer example

```tsx
{
  name: "status",
  type: "set",
  precedence: 100,
  setValues: ["New", "Done", "Blocked"],
  renderers: {
    pill: ({ defaultText, value }) => (
      <span data-status={String(value).toLowerCase()}>{defaultText}</span>
    ),
    match: ({ defaultText }) => <strong>{defaultText}</strong>,
    hint: ({ defaultText }) => <em>{defaultText}</em>,
  },
}
```

### Custom editor example

```tsx
{
  name: "rating",
  type: "integer",
  precedence: 80,
  editor: ({ value, onChange, onCommit, onCancel }) => (
    <span>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => {
            onChange(String(star));
            onCommit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
        >
          {Number(value) >= star ? "*" : "o"}
        </button>
      ))}
    </span>
  ),
}
```

## Keyboard behavior

| Key | Action |
| --- | --- |
| `Enter` | Commit current input or pick the highlighted match |
| `ArrowUp` / `ArrowDown` | Navigate matches or editor suggestions |
| `Home` / `End` | Jump to first or last match |
| `ArrowLeft` / `ArrowRight` | Move selection between pills when input is empty |
| `Backspace` / `Delete` | Delete selected pills when input is empty |
| `Escape` | Cancel editing or clear active input state |
| `Ctrl+C` / `Cmd+C` | Copy selected pills |
| `Ctrl+V` / `Cmd+V` | Paste copied pills |
| double-click | Edit a value, list, or range pill inline |

## Drag and drop

Pills can be reordered by dragging them to a new position within the filter row.

How it works:

- hover any pill to see the grab cursor
- drag a pill left or right to a drop zone between pills
- a blue bar appears between pills to show where the drop will land
- drop the pill to commit the new order
- `onChange` is called immediately with the updated pill array

The drag state is managed entirely within the component. No external state changes are needed to support drag and drop — just respond to `onChange` as normal.

```tsx
// The existing onChange handler is all you need.
<AiFilter
  fields={fields}
  pills={pills}
  onChange={setPills}   // receives reordered pills
  onClear={() => setPills([])}
/>
```

Dragging is disabled when a pill is in inline-edit mode. All pill types are draggable, including boolean toggle pills and logical tokens (AND, OR, brackets).

## AG Grid integration

`ai-filter` can generate filter fields from an AG Grid column model and apply filter expressions directly to AG Grid's external filter API.

### Connecting to AG Grid

Pass the AG Grid API object to the `agGrid` prop:

```tsx
import { useRef, useState, useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import { AiFilter } from "ai-filter";
import type { FilterPill, AgGridApi } from "ai-filter";
import "ai-filter/dist/style.css";

export function MyGrid(): JSX.Element {
  const gridRef = useRef<AgGridReact>(null);
  const [pills, setPills] = useState<FilterPill[]>([]);

  const agGridApi = useMemo<AgGridApi | undefined>(
    () => ({
      getColumns: () => gridRef.current?.api?.getColumns?.() ?? null,
      forEachNode: (cb) => gridRef.current?.api?.forEachNode(cb),
      setGridOption: (key, value) => gridRef.current?.api?.setGridOption(key, value),
      onFilterChanged: () => gridRef.current?.api?.onFilterChanged(),
    }),
    [],
  );

  const columnDefs = useMemo(
    () => [
      { field: "title", headerName: "Title", cellDataType: "text" },
      { field: "priority", headerName: "Priority", cellDataType: "number" },
      { field: "status", headerName: "Status", filter: "agSetColumnFilter",
        filterParams: { values: ["New", "In Progress", "Done"] } },
      { field: "active", headerName: "Active", cellDataType: "boolean" },
      { field: "due", headerName: "Due", cellDataType: "dateString" },
    ],
    [],
  );

  return (
    <>
      <AiFilter
        agGrid={agGridApi}
        pills={pills}
        onChange={setPills}
        onClear={() => setPills([])}
      />
      <AgGridReact
        ref={gridRef}
        columnDefs={columnDefs}
        rowData={rowData}
        isExternalFilterPresent={() => false}
        doesExternalFilterPass={() => true}
      />
    </>
  );
}
```

When `agGrid` is connected, `ai-filter`:

1. reads the column definitions to build `FieldDefinition[]` automatically
2. maps `cellDataType` to the appropriate `FieldType` (see table below)
3. treats columns with `filter: "agSetColumnFilter"` as `set` fields
4. loads unique row values for set fields with no static `filterParams.values`
5. rewrites `isExternalFilterPresent` and `doesExternalFilterPass` on AG Grid whenever pills change

### `AgGridApi` type

| Property | Type | Description |
| --- | --- | --- |
| `getColumns` | `() => AgGridColumn[] \| null` | Returns all current grid columns. Used to build field definitions. Provide either `getColumns` or `getAllGridColumns`. |
| `getAllGridColumns` | `() => AgGridColumn[] \| null` | Alternative column accessor (AG Grid v31+). Prefer `getColumns` when available. |
| `forEachNode` | `(callback: (node: AgGridRowNode) => void) => void` | Iterates all row nodes. Used to collect unique set values when `filterParams.values` is not a static array. |
| `setGridOption` | `(key: string, value: unknown) => void` | Updates a grid option at runtime. Used to push updated `isExternalFilterPresent` and `doesExternalFilterPass` callbacks into the grid. |
| `onFilterChanged` | `() => void` | Notifies AG Grid that external filter state has changed and the grid should re-evaluate rows. |

Tip: wrap the `AgGridApi` object in `useMemo` so that its identity is stable across renders. Recreating the object on every render causes unnecessary filter sync.

### `cellDataType` to `FieldType` mapping

| AG Grid `cellDataType` | AiFilter `FieldType` |
| --- | --- |
| `text` | `string` |
| `number` | `float` |
| `boolean` | `boolean` |
| `date` | `date` |
| `dateString` | `date` |
| `dateTime` | `datetime` |
| `dateTimeString` | `datetime` |
| anything else / unset | `string` |
| column with `agSetColumnFilter` | `set` (overrides cellDataType) |

### Merging user fields with AG Grid fields

Fields provided via `fields` prop are merged with AG Grid-generated fields. A user field with the same `name` completely replaces the generated field.

```tsx
<AiFilter
  agGrid={agGridApi}
  fields={[
    // override the generated "status" field with a custom label and hints
    {
      name: "status",
      type: "set",
      precedence: 100,
      label: "Status",
      setValues: ["New", "In Progress", "Done"],
      hints: "fieldValues",
    },
  ]}
  pills={pills}
  onChange={setPills}
/>
```

### External filter callbacks

`ai-filter` exports two utilities for advanced use cases where you need direct control over AG Grid's external filter:

#### `buildAgGridExternalFilter`

Builds an `AgGridExternalFilter` object from pills without syncing it to a live grid:

```ts
import { buildAgGridExternalFilter } from "ai-filter";

const { isExternalFilterPresent, doesExternalFilterPass } =
  buildAgGridExternalFilter(pills, fields);
```

Returned shape:

```ts
type AgGridExternalFilter = {
  isExternalFilterPresent: () => boolean;
  doesExternalFilterPass: (node: AgGridRowNode) => boolean;
};
```

- `isExternalFilterPresent()` returns `true` when there is at least one non-logical pill
- `doesExternalFilterPass(node)` evaluates the full pill expression against a single row node's `data`

#### `syncAgGridExternalFilter`

Pushes updated external filter callbacks into a live AG Grid instance and triggers a re-evaluation:

```ts
import { syncAgGridExternalFilter } from "ai-filter";

syncAgGridExternalFilter({ api: agGridApi, pills, fields, onFilterChange });
```

Parameters:

| Parameter | Type | Description |
| --- | --- | --- |
| `api` | `AgGridApi` | The `AgGridApi` object from the component prop. |
| `pills` | `FilterPill[]` | Current pill array. |
| `fields` | `FieldDefinition[]` | Field definitions to use for evaluation. |
| `onFilterChange` | `(event: FilterChangeEvent) => void` | Optional callback fired after sync with updated filter state. |

### `FilterChangeEvent`

```ts
type FilterChangeEvent = {
  pills: FilterPill[];
  filter: AgGridExternalFilter;
};
```

Received by `onFilterChange` after every pill change when `agGrid` is connected.

### Supported filter expressions

All pill types are supported by the external filter:

| Pill kind | Operators supported | Notes |
| --- | --- | --- |
| `value` (string) | `=` `!` `*` `!*` `<*` `>*` | Case-insensitive |
| `value` (number) | `=` `!` `>` `<` `>=` `<=` | Numeric comparison |
| `value` (boolean) | `=` `!` | Compared as JS boolean |
| `value` (date/datetime) | `=` `!` `>` `<` `>=` `<=` | ISO string comparison |
| `list` | `in` | `!` negates membership |
| `range` | — | Inclusive between check |
| `and` / `or` / brackets | — | Full boolean logic with correct precedence |

## Styling

The distributed stylesheet exposes CSS variables that you can override globally or per container.

Example:

```css
:root {
  --ef-line-height: 2.1rem;
  --ef-border: #b0b8c8;
  --ef-focus: #003d7a;
  --ef-bg: #f4f6f9;
  --ef-surface: #ffffff;
  --ef-chip: #dde4ef;
  --ef-chip-selected: #b3c5dd;
  --ef-text: #0c1520;
  --ef-muted: #5a6475;
  --ef-danger: #9b1515;
  --ef-shadow: 0 3px 10px rgba(5, 15, 35, 0.12), 0 1px 3px rgba(5, 15, 35, 0.07);
}
```

## Code structure

Important files in the library:

| File | Responsibility |
| --- | --- |
| `src/lib/components/AiFilter/AiFilter.tsx` | Main component orchestration, input handling, AI mode, dropdown visibility, and async set lookup triggering. |
| `src/lib/context.tsx` | Shared state for config, pill data, UI state, async set values, hints, and recent values. |
| `src/lib/components/AiFilter/AiFilter.utils.ts` | Match-dropdown generation and ranking logic. |
| `src/lib/parser.ts` | Input-to-pill parsing, pill normalization, formatting, and IDs. |
| `src/lib/operators.ts` | Operator defaults, operator parsing, plausibility checks, and validation rules. |
| `src/lib/nlpResolver.ts` | Natural-language expression/query parsing into `FilterPill` data. |
| `src/lib/components/HintPanel/*` | Field, operator, and hint panel UI. |
| `src/lib/components/PillEditor/*` | Inline editors for single values, lists, and ranges. |
| `src/lib/components/PillsArea/*` | Pill layout, drag/drop insertion, and main input placement. |
| `src/lib/types.ts` | Public type surface for fields, hints, renderers, pills, and NLP helpers. |

High-level flow:

1. user types or clicks a hint or match
2. AiFilter resolves that input into a `FilterPill`
3. pills are normalized and emitted through `onChange`
4. hints and matches re-render from the current input, fields, loaded set values, and recent values

## Development

```bash
npm run dev
npm run build
npm run ladle
npm run ladle:build
```

Stories live in `src/stories/AiFilter.stories.tsx`.

