import { useEffect, useState } from "react";
import { isValidValue } from "../../operators";
import { formatDateValue } from "../../parser";
import type { FieldDefinition, ListPill, RangePill, ValuePill } from "../../types";
import { PillEditorContext } from "./PillEditorContext";
import { ListEditor } from "./ListEditor";
import { RangeEditor } from "./RangeEditor";
import { ValueEditor } from "./ValueEditor";

export function valueToText(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function parseEditorRaw(field: FieldDefinition, raw: string): unknown {
  if (field.translate) {
    return field.translate(raw);
  }

  if (field.type === "integer") {
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? raw : n;
  }

  if (field.type === "float") {
    const n = Number.parseFloat(raw);
    return Number.isNaN(n) ? raw : n;
  }

  if (field.type === "boolean") {
    return /^true|1|yes$/i.test(raw);
  }

  if (field.type === "date" || field.type === "datetime") {
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) return raw;
    return d.toISOString();
  }

  return raw;
}

export function PillEditor(props: {
  pill: ValuePill | ListPill | RangePill;
  field: FieldDefinition;
  setOptions?: string[];
  onCommit: (pill: ValuePill | ListPill | RangePill) => void;
  onCancel: () => void;
  /** Called with the current typed text whenever it changes (set-type fields only). */
  onLookupChange?: (text: string) => void;
}): JSX.Element {
  const [local, setLocal] = useState(() => {
    const dateField = props.field.type === "date" || props.field.type === "datetime";
    const fmt = dateField ? (props.field as { dateFormat?: string }).dateFormat : undefined;
    function toDisplay(v: unknown): string {
      if (dateField && v) return formatDateValue(v, props.field.type as "date" | "datetime", fmt);
      return valueToText(v);
    }
    if (props.pill.kind === "list") return props.pill.values.map(toDisplay).join(", ");
    if (props.pill.kind === "range") return toDisplay(props.pill.from);
    return toDisplay(props.pill.value);
  });
  const [localTo, setLocalTo] = useState(() => {
    const dateField = props.field.type === "date" || props.field.type === "datetime";
    const fmt = dateField ? (props.field as { dateFormat?: string }).dateFormat : undefined;
    if (props.pill.kind === "range") {
      if (dateField) return formatDateValue(props.pill.to, props.field.type as "date" | "datetime", fmt);
      return valueToText(props.pill.to);
    }
    return "";
  });

  const options = props.setOptions ?? [];
  const query = local.trim().toLowerCase();
  const filteredOptions =
    props.field.type === "set"
      ? options.filter((opt) => opt.toLowerCase().includes(query))
      : [];

  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setSuggestionIndex(0);
  }, [local]);

  useEffect(() => {
    if (props.field.type !== "set") return;
    props.onLookupChange?.(local);
  // onLookupChange is intentionally excluded — callers may pass inline lambdas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, props.field.type]);

  const inputType: "text" | "number" | "date" | "datetime-local" =
    props.field.type === "datetime"
      ? "datetime-local"
      : props.field.type === "date"
        ? "date"
        : props.field.type === "integer" || props.field.type === "float"
          ? "number"
          : "text";

  function saveRange(): void {
    if (props.pill.kind !== "range") return;
    const from = local.trim();
    const to = localTo.trim();
    if (!from || !to) {
      props.onCancel();
      return;
    }
    if (!isValidValue(props.field, from) || !isValidValue(props.field, to)) {
      setIsError(true);
      return;
    }
    setIsError(false);
    props.onCommit({
      ...props.pill,
      from: parseEditorRaw(props.field, from),
      to: parseEditorRaw(props.field, to),
    });
  }

  function save(): void {
    const text = local.trim();
    if (!text) {
      props.onCancel();
      return;
    }

    if (props.field.type === "set" && props.pill.kind === "value") {
      const exact = options.find((opt) => opt.toLowerCase() === text.toLowerCase());
      if (!exact) { setIsError(true); return; }
      setIsError(false);
      props.onCommit({ ...props.pill, value: exact });
      return;
    }

    if (props.field.type === "set" && props.pill.kind === "list") {
      const parts = text
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (!parts.length) return;
      const resolved = parts.map(
        (part) => options.find((opt) => opt.toLowerCase() === part.toLowerCase()) ?? "",
      );
      if (resolved.some((v) => !v)) { setIsError(true); return; }
      setIsError(false);
      props.onCommit({ ...props.pill, values: resolved });
      return;
    }

    if (!isValidValue(props.field, text)) {
      setIsError(true);
      return;
    }
    setIsError(false);

    if (props.pill.kind === "list") {
      props.onCommit({
        ...props.pill,
        values: text.split(",").map((p) => parseEditorRaw(props.field, p.trim())),
      });
      return;
    }

    if (props.pill.kind === "range") {
      const parts = text.split(/\s+to\s+/i);
      if (parts.length === 2) {
        props.onCommit({
          ...props.pill,
          from: parseEditorRaw(props.field, parts[0]),
          to: parseEditorRaw(props.field, parts[1]),
        });
      } else {
        props.onCancel();
      }
      return;
    }

    props.onCommit({ ...props.pill, value: parseEditorRaw(props.field, text) });
  }

  const ctxValue = {
    pill: props.pill,
    field: props.field,
    options,
    local,
    setLocal,
    localTo,
    setLocalTo,
    filteredOptions,
    suggestionIndex,
    setSuggestionIndex,
    inputType,
    isError,
    save,
    saveRange,
    onCommit: props.onCommit,
    onCancel: props.onCancel,
  };

  if (props.field.editor) {
    return (
      <PillEditorContext.Provider value={ctxValue}>
        <>
          {props.field.editor({
            value: local,
            onChange: setLocal,
            onCommit: save,
            onCancel: props.onCancel,
          })}
        </>
      </PillEditorContext.Provider>
    );
  }

  return (
    <PillEditorContext.Provider value={ctxValue}>
      {props.pill.kind === "range" ? (
        <RangeEditor />
      ) : props.pill.kind === "list" ? (
        <ListEditor />
      ) : (
        <ValueEditor />
      )}
    </PillEditorContext.Provider>
  );
}
