import {
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GhostButton } from "../ui/GhostButton";
import {
  AiFilterProvider,
  useConfigSelector,
  useDataSelector,
  useUiSelector,
} from "../../context";
import { findLeadingOperator, operatorsForField } from "../../operators";
import { makeId, normalizePills, parseInputToPill } from "../../parser";
import { fieldsFromAgGrid, mergeWithAgGridFields } from "../../agGridAdapter";
import { syncAgGridExternalFilter } from "../../agGridExternalFilter";
import type {
  AnyOperator,
  AiFilterProps,
  FieldDefinition,
  FieldMatch,
  FilterPill,
  Hint,
  ListPill,
  RangePill,
  ValuePill,
} from "../../types";
import { HintPanel } from "../HintPanel/HintPanel";
import { MatchDropdown } from "../MatchDropdown/MatchDropdown";
import { PillsArea } from "../PillsArea/PillsArea";
import { AiIcon } from "../SearchIcon/AiIcon";
import { HourglassIcon } from "../SearchIcon/HourglassIcon";
import { SearchIcon } from "../SearchIcon/SearchIcon";
import { aiToFilterPills } from "./aiPrompt";
import { matchesFromInput } from "./AiFilter.utils";
import styles from "./AiFilter.module.less";

function CoreFilter(props: Pick<AiFilterProps, "className" | "ai" | "colorScheme" | "matchDropdownMaxHeight" | "suggestionsDropdownSticky" | "hintPanelMaxHeight" | "hintColumns" | "matchRanking" | "hintVirtualized">): JSX.Element {
  const fields = useConfigSelector((s) => s.fields);
  const onClear = useConfigSelector((s) => s.onClear);

  const pills = useDataSelector((s) => s.pills);
  const setPills = useDataSelector((s) => s.setPills);
  const setValuesByField = useDataSelector((s) => s.setValuesByField);
  const hintsByField = useDataSelector((s) => s.hintsByField);
  const recentByField = useDataSelector((s) => s.recentByField);
  const favoriteFieldCounts = useDataSelector((s) => s.favoriteFieldCounts);
  const loadSetValues = useDataSelector((s) => s.loadSetValues);
  const rememberValue = useDataSelector((s) => s.rememberValue);

  const focused = useUiSelector((s) => s.focused);
  const setFocused = useUiSelector((s) => s.setFocused);
  const inputValue = useUiSelector((s) => s.inputValue);
  const setInputValue = useUiSelector((s) => s.setInputValue);
  const insertIndex = useUiSelector((s) => s.insertIndex);
  const setInsertIndex = useUiSelector((s) => s.setInsertIndex);
  const selectedIds = useUiSelector((s) => s.selectedIds);
  const setSelectedIds = useUiSelector((s) => s.setSelectedIds);
  const editingId = useUiSelector((s) => s.editingId);
  const setEditingId = useUiSelector((s) => s.setEditingId);
  const setHintValueFilterText = useUiSelector((s) => s.setHintValueFilterText);
  const activeField = useUiSelector((s) => s.activeField);
  const setActiveField = useUiSelector((s) => s.setActiveField);
  const highlightIndex = useUiSelector((s) => s.highlightIndex);
  const setHighlightIndex = useUiSelector((s) => s.setHighlightIndex);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pillsAreaRef = useRef<HTMLDivElement | null>(null);

  const aiConfig = props.ai === false || props.ai == null ? false : props.ai;
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function focusInput(): void {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const length = el.value.length;
      el.setSelectionRange(length, length);
    });
  }

  function showAndFocusInput(): void {
    setFocused(true);
    setSelectedIds([]);
    setEditingId(undefined);
    focusInput();
  }

  function moveInputToSlot(slot: number): void {
    setInsertIndex(slot);
    setInputValue("");
    showAndFocusInput();
  }

  useEffect(() => {
    const raw = inputValue;
    if (!raw.trim()) return;

    const prefixedField = fields.find((field) => {
      if (field.type !== "set") return false;
      const name = field.name.toLowerCase();
      const loweredRaw = raw.toLowerCase();
      const trimmedLower = raw.trim().toLowerCase();
      return (
        loweredRaw.startsWith(`${name} `) ||
        (trimmedLower === name && raw !== raw.trimEnd())
      );
    });

    if (prefixedField && prefixedField.type === "set" && typeof prefixedField.setValues === "function") {
      // Prefix case: extract lookup text after the operator.
      const prefix = `${prefixedField.name.toLowerCase()} `;
      const afterField = raw.toLowerCase().startsWith(prefix)
        ? raw.slice(prefixedField.name.length).trim()
        : "";
      const { rest } = findLeadingOperator(afterField);
      loadSetValues(prefixedField, rest.trim()).catch(() => {});
      return;
    }

    // No-prefix case: call all async set fields with the typed lookup text.
    const { rest } = findLeadingOperator(raw.trim());
    const lookupText = rest.trim();
    if (!lookupText) return;
    for (const field of fields) {
      if (field.type !== "set") continue;
      if (typeof field.setValues !== "function") continue;
      loadSetValues(field, lookupText).catch(() => {});
    }
  }, [fields, inputValue, loadSetValues]);

  const matches = useMemo(
    () =>
      matchesFromInput({
        input: inputValue,
        fields,
        setValuesByField,
        hintsByField,
        favoriteFieldCounts,
        recentByField,
        matchRanking: props.matchRanking,
        pillCountByField: pills.reduce<Record<string, number>>((acc, p) => {
          if ("fieldName" in p) acc[p.fieldName] = (acc[p.fieldName] ?? 0) + 1;
          return acc;
        }, {}),
      }),
    [inputValue, fields, setValuesByField, hintsByField, favoriteFieldCounts, recentByField, props.matchRanking, pills],
  );

  const keepSuggestionsVisible =
    Boolean(props.suggestionsDropdownSticky);

  const inputContext = useMemo(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return { inputField: undefined, inputOperator: undefined };
    for (const field of fields) {
      if (trimmed.toLowerCase().startsWith(`${field.name.toLowerCase()} `)) {
        const afterField = trimmed.slice(field.name.length).trim();
        const { op } = findLeadingOperator(afterField);
        return { inputField: field, inputOperator: op as AnyOperator | undefined };
      }
    }
    return { inputField: undefined, inputOperator: undefined };
  }, [fields, inputValue]);

  function commitInput(rawText?: string): void {
    const text = (rawText ?? inputValue).trim();
    if (!text) return;

    if (rawText === undefined) {
      const hasFieldPrefix = fields.some((f) =>
        text.toLowerCase().startsWith(`${f.name.toLowerCase()} `),
      );
      // If a field prefix is present but no matches were generated, the value or
      // operator is invalid for that field — refuse to commit.
      if (hasFieldPrefix && matches.length === 0) return;
      if (!hasFieldPrefix) {
        const candidates = matches.filter((m) => m.type === "value-candidate");
        if (candidates.length > 1) {
          setHighlightIndex(matches.findIndex((m) => m.type === "value-candidate"));
          return;
        }
      }
    }

    const previousPill = insertIndex > 0 ? pills[insertIndex - 1] : undefined;
    const parsed = parseInputToPill({
      input: text,
      fields,
      preferredField: activeField,
      previousPill,
    });

    if (!parsed) return;

    const willReplace =
      parsed.kind === "list" &&
      (previousPill?.kind === "list" || previousPill?.kind === "value") &&
      previousPill?.fieldName === parsed.fieldName &&
      previousPill?.operator === parsed.operator &&
      insertIndex > 0;

    if (!willReplace && "fieldName" in parsed) {
      const field = fields.find((f) => f.name === parsed.fieldName);
      if (field?.maxInstances !== undefined) {
        const currentCount = pills.filter(
          (p) => "fieldName" in p && p.fieldName === parsed.fieldName,
        ).length;
        if (currentCount >= field.maxInstances) return;
      }
    }

    setPills((prev) => {
      const next = [...prev];
      if (willReplace) {
        next[insertIndex - 1] = parsed;
      } else {
        next.splice(insertIndex, 0, parsed);
      }
      const normalized = normalizePills(next);
      if ("fieldName" in parsed) {
        if (parsed.kind === "list") {
          parsed.values.forEach((v) => rememberValue(parsed.fieldName, v));
        } else if (parsed.kind === "range") {
          rememberValue(parsed.fieldName, `${String(parsed.from)} to ${String(parsed.to)}`);
        } else {
          rememberValue(parsed.fieldName, parsed.value);
        }
      }
      return normalized;
    });

    setInputValue("");
    setHighlightIndex(0);
    setSelectedIds([parsed.id]);
    setEditingId(undefined);
    setInsertIndex(willReplace ? insertIndex - 1 : insertIndex);
    focusInput();
  }

  async function submitAiQuery(query: string): Promise<void> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || !aiConfig) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const newPills = await aiToFilterPills(trimmedQuery, fields, setValuesByField, aiConfig.resolve);
      if (newPills.length === 0) {
        setAiError("No filter conditions could be parsed. Try rephrasing your query.");
        return;
      }
      setPills(normalizePills(newPills));
      setInsertIndex(newPills.length);
      setInputValue("");
      setSelectedIds([]);
      setEditingId(undefined);
      focusInput();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    if (!editingId) {
      setHintValueFilterText("");
    }
  }, [editingId, setHintValueFilterText]);

  function clearAll(): void {
    setPills([]);
    setInputValue("");
    setHintValueFilterText("");
    setSelectedIds([]);
    onClear?.();
    // Mode will reset to "ai" via the useEffect watching pills/inputValue.
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (matches.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex(Math.min(matches.length - 1, highlightIndex + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex(Math.max(0, highlightIndex - 1));
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setHighlightIndex(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setHighlightIndex(matches.length - 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const choice = matches[highlightIndex];
        if (choice) {
          pickMatch(choice);
          return;
        }
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (aiConfig && !aiLoading && inputValue.trim() && matches.length === 0) {
        void submitAiQuery(inputValue);
        return;
      }
      commitInput();
      return;
    }

    if (e.key === "ArrowLeft" && !inputValue) {
      const prevIndex = Math.max(0, insertIndex - 1);
      const pill = pills[prevIndex];
      if (pill) {
        setSelectedIds([pill.id]);
        rootRef.current?.focus();
      }
      return;
    }

    if (e.key === "ArrowRight" && !inputValue) {
      const nextPill = pills[insertIndex];
      if (nextPill) {
        setSelectedIds([nextPill.id]);
        rootRef.current?.focus();
      }
      return;
    }

    if ((e.key === "Backspace" || e.key === "Delete") && !inputValue && selectedIds.length) {
      e.preventDefault();
      setPills((prev) => normalizePills(prev.filter((pill) => !selectedIds.includes(pill.id))));
      setSelectedIds([]);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      if (!selectedIds.length) return;
      e.preventDefault();
      const selectedPills = pills.filter((pill) => selectedIds.includes(pill.id));
      void navigator.clipboard.writeText(`ai-filter:${JSON.stringify(selectedPills)}`);
      return;
    }

  }

  function splitDelimitedValues(text: string): string[] | undefined {
    if (!/[\t\n\r,]/.test(text)) return undefined;
    const values = text
      .split(/[\t\n\r,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    return values.length > 1 ? values : undefined;
  }

  function insertRawPasteText(text: string): void {
    const el = inputRef.current;
    if (!el) {
      setInputValue((prev) => `${prev}${text}`);
      return;
    }
    const start = el.selectionStart ?? inputValue.length;
    const end = el.selectionEnd ?? inputValue.length;
    const next = `${inputValue.slice(0, start)}${text}${inputValue.slice(end)}`;
    setInputValue(next);
    requestAnimationFrame(() => {
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function pasteStructuredPills(value: string): void {
    if (!value.startsWith("ai-filter:")) return;
    try {
      const pasted = JSON.parse(value.slice("ai-filter:".length)) as FilterPill[];
      setPills((prev) => {
        const next = [...prev];
        next.splice(insertIndex, 0, ...pasted.map((pill) => ({ ...pill, id: makeId() })));
        return normalizePills(next);
      });
    } catch {
      // Ignore malformed clipboard payload.
    }
  }

  function promptPasteField(fieldsToChoose: FieldDefinition[]): FieldDefinition | undefined {
    if (fieldsToChoose.length === 1) return fieldsToChoose[0];
    const message = [
      "Multiple fields match the pasted values. Choose a field:",
      ...fieldsToChoose.map((field, i) => `${i + 1}. ${field.label ?? field.name}`),
    ].join("\n");
    const response = window.prompt(message, "1");
    if (!response) return undefined;
    const index = Number.parseInt(response, 10) - 1;
    if (Number.isNaN(index) || index < 0 || index >= fieldsToChoose.length) return undefined;
    return fieldsToChoose[index];
  }

  async function fieldMatchesPastedValues(field: FieldDefinition, values: string[]): Promise<boolean> {
    if (!operatorsForField(field).includes("in")) return false;

    if (field.pasteMatch) {
      const checks = await Promise.all(values.map((v) => Promise.resolve(field.pasteMatch?.(v))));
      return checks.every(Boolean);
    }

    if (field.type !== "set") return false;
    const knownValues = Array.isArray(field.setValues)
      ? field.setValues
      : (setValuesByField[field.name] ?? []);
    if (!knownValues.length) return false;

    const known = new Set(knownValues.map((v) => String(v).toLowerCase()));
    return values.every((value) => known.has(value.toLowerCase()));
  }

  async function tryHandleDelimitedPaste(values: string[]): Promise<boolean> {
    const listFields = fields.filter((field) => operatorsForField(field).includes("in"));
    const matchesField: FieldDefinition[] = [];

    for (const field of listFields) {
      if (await fieldMatchesPastedValues(field, values)) {
        matchesField.push(field);
      }
    }

    if (!matchesField.length) return false;
    const selectedField = promptPasteField(matchesField);
    if (!selectedField) return true;
    commitInput(`${selectedField.name} in ${values.join(",")}`);
    return true;
  }

  function onInputPaste(e: ClipboardEvent<HTMLInputElement>): void {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!text) return;

    if (text.startsWith("ai-filter:")) {
      e.preventDefault();
      pasteStructuredPills(text);
      return;
    }

    const values = splitDelimitedValues(text);
    if (!values) return;

    e.preventDefault();
    void tryHandleDelimitedPaste(values).then((handled) => {
      if (!handled) {
        insertRawPasteText(text);
      }
    });
  }

  function pickMatch(match: FieldMatch): void {
    if (match.type === "field") {
      setActiveField(match.field.name);
      setInputValue(`${match.field.name} `);
      return;
    }

    if (match.type === "value-candidate") {
      const op = match.operator ?? "=";
      commitInput(`${match.field.name} ${op} ${match.text}`);
      return;
    }

    if (match.type === "set-value") {
      const op = match.operator ?? "=";
      commitInput(`${match.field.name} ${op} ${match.setValue ?? match.text}`);
      return;
    }

    if (match.hint?.kind === "single") {
      commitInput(
        `${match.field.name} ${String(match.hint.operator)} ${String(match.hint.value)}`,
      );
      return;
    }

    if (match.hint?.kind === "list") {
      commitInput(`${match.field.name} in ${match.hint.values.map((v) => String(v)).join(",")}`);
      return;
    }

    if (match.hint?.kind === "range") {
      commitInput(`${match.field.name} ${String(match.hint.from)} to ${String(match.hint.to)}`);
      return;
    }

    commitInput(match.text);
  }

  function pickHint(field: FieldDefinition, hint: Hint, isSelected: boolean): void {
    const activeIds = [...new Set([...(editingId ? [editingId] : []), ...selectedIds])];
    const activePills = pills.filter((p) => activeIds.includes(p.id));

    if (activePills.length) {
      if (field.type === "set" && hint.kind === "single") {
        const target = activePills.find(
          (p) =>
            "fieldName" in p &&
            p.fieldName === field.name &&
            (p.kind === "value" || p.kind === "list"),
        );

        if (target && (target.kind === "value" || target.kind === "list")) {
          const current: unknown[] =
            target.kind === "list" ? [...target.values] : [target.value];
          const nextValues = isSelected
            ? current.filter((v) => String(v) !== String(hint.value))
            : current.some((v) => String(v) === String(hint.value))
              ? current
              : [...current, hint.value];

          if (nextValues.length === 0) {
            setPills((prev) => normalizePills(prev.filter((p) => p.id !== target.id)));
            setSelectedIds([]);
            setEditingId(undefined);
          } else if (nextValues.length === 1) {
            setPills((prev) =>
              normalizePills(
                prev.map((p) =>
                  p.id === target.id
                    ? ({ ...p, kind: "value" as const, value: nextValues[0] } as ValuePill)
                    : p,
                ),
              ),
            );
            setEditingId(undefined);
            setSelectedIds([target.id]);
          } else {
            setPills((prev) =>
              normalizePills(
                prev.map((p) =>
                  p.id === target.id
                    ? ({ ...p, kind: "list" as const, values: nextValues } as ListPill)
                    : p,
                ),
              ),
            );
            setEditingId(undefined);
            setSelectedIds([target.id]);
          }
          return;
        }

        if (!isSelected) {
          setEditingId(undefined);
          commitInput(`${field.name} = ${String(hint.value)}`);
        }
        return;
      }

      if (isSelected) {
        setPills((prev) =>
          normalizePills(
            prev.filter((pill) => {
              if (!activeIds.includes(pill.id)) return true;
              if (!("fieldName" in pill) || pill.fieldName !== field.name) return true;
              if (hint.kind === "single" && pill.kind === "value") {
                return String(pill.value) !== String(hint.value);
              }
              if (hint.kind === "range" && pill.kind === "range") {
                return !(
                  String(pill.from) === String(hint.from) &&
                  String(pill.to) === String(hint.to)
                );
              }
              return true;
            }),
          ),
        );
        setSelectedIds([]);
        setEditingId(undefined);
        return;
      }

      const target = activePills.find(
        (p) =>
          "fieldName" in p &&
          p.fieldName === field.name &&
          (p.kind === "value" || p.kind === "range"),
      );
      if (target && (target.kind === "value" || target.kind === "range")) {
        setPills((prev) =>
          normalizePills(
            prev.map((p) => {
              if (p.id !== target.id) return p;
              if (hint.kind === "single") {
                return {
                  ...p,
                  kind: "value" as const,
                  operator: hint.operator as AnyOperator,
                  value: hint.value,
                } as ValuePill;
              }
              if (hint.kind === "range") {
                return {
                  ...p,
                  kind: "range" as const,
                  from: hint.from,
                  to: hint.to,
                } as RangePill;
              }
              return p;
            }),
          ),
        );
        setEditingId(undefined);
        return;
      }
    }

    setEditingId(undefined);
    if (hint.kind === "single") {
      commitInput(`${field.name} ${String(hint.operator)} ${String(hint.value)}`);
      return;
    }
    if (hint.kind === "list") {
      commitInput(`${field.name} in ${hint.values.map((v) => String(v)).join(",")}`);
      return;
    }
    commitInput(`${field.name} ${String(hint.from)} to ${String(hint.to)}`);
  }

  function insertOperator(field: FieldDefinition, operator: AnyOperator): void {
    const activeIds = [...new Set([...(editingId ? [editingId] : []), ...selectedIds])];
    if (activeIds.length) {
      setPills((prev) =>
        normalizePills(
          prev.map((pill) => {
            if (!activeIds.includes(pill.id)) return pill;
            if (!("fieldName" in pill) || pill.fieldName !== field.name) return pill;
            if (pill.kind !== "value" && pill.kind !== "list") return pill;
            return { ...pill, operator };
          }),
        ),
      );
      if (editingId) setEditingId(undefined);
      return;
    }

    const trimmed = inputValue.trim();
    if (inputContext.inputField?.name === field.name) {
      const afterField = trimmed.slice(field.name.length).trim();
      const { rest } = findLeadingOperator(afterField);
      const newInput = rest
        ? `${field.name} ${String(operator)} ${rest} `
        : `${field.name} ${String(operator)} `;
      setInputValue(newInput);
      setActiveField(field.name);
      focusInput();
      return;
    }

    const prefix = trimmed.length > 0 ? inputValue.trimEnd() : `${field.name}`;
    const next = `${prefix} ${String(operator)} `;
    setActiveField(field.name);
    setInputValue(next);
    setInsertIndex(pills.length);
    showAndFocusInput();
  }

  function handlePickHint(field: FieldDefinition, hint: Hint, isSelected: boolean): void {
    pickHint(field, hint, isSelected);
  }

  function insertFieldName(field: FieldDefinition): void {
    const trimmed = inputValue.trim();
    const currentInputField = fields.find((f) => {
      const lower = trimmed.toLowerCase();
      const fname = f.name.toLowerCase();
      return lower === fname || lower.startsWith(`${fname} `);
    });
    if (currentInputField) {
      const afterField = trimmed.slice(currentInputField.name.length).trimStart();
      setInputValue(afterField ? `${field.name} ${afterField}${afterField.endsWith(" ") ? "" : " "}` : `${field.name} `);
    } else {
      const separator = trimmed.length > 0 ? " " : "";
      setInputValue(`${inputValue.trimEnd()}${separator}${field.name} `);
    }
    setActiveField(field.name);
    setInsertIndex(pills.length);
    showAndFocusInput();
  }

  function onRootKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (editingId) return;
    if (pills.length === 0) return;

    if (e.key === "Home") {
      e.preventDefault();
      setSelectedIds([pills[0].id]);
      setInsertIndex(0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      setSelectedIds([pills[pills.length - 1].id]);
      setInsertIndex(pills.length - 1);
      return;
    }

    if (!selectedIds.length && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const idx = e.key === "ArrowLeft" ? pills.length - 1 : 0;
      setSelectedIds([pills[idx].id]);
      setInsertIndex(idx);
      return;
    }

    if (!selectedIds.length) return;
    const anchorId = selectedIds[selectedIds.length - 1];
    const currentIndex = pills.findIndex((pill) => pill.id === anchorId);
    if (currentIndex === -1) return;

    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const nextIndex = e.key === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1;
    const bounded = Math.max(0, Math.min(pills.length - 1, nextIndex));
    const nextId = pills[bounded]?.id;
    if (!nextId) return;

    if (e.ctrlKey || e.metaKey) {
      setSelectedIds(selectedIds.includes(nextId) ? selectedIds : [...selectedIds, nextId]);
      return;
    }

    setSelectedIds([nextId]);
    setInsertIndex(bounded);
  }

  function focusRoot(): void {
    rootRef.current?.focus();
  }

  function handleFocusCapture(): void {
    setFocused(true);
  }

  function handleBlurCapture(e: FocusEvent<HTMLDivElement>): void {
    const next = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(next)) {
      setFocused(false);
      setSelectedIds([]);
      setEditingId(undefined);
      setInsertIndex(pills.length);
      requestAnimationFrame(() => {
        const el = pillsAreaRef.current;
        if (el) el.scrollLeft = el.scrollWidth;
      });
    }
  }

  function handleFrameMouseDown(e: MouseEvent<HTMLDivElement>): void {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-ef="pill-delete"]') ||
      target.closest('[data-ef="clear"]')
    ) {
      return;
    }
    if (target.closest('[data-ef="pill"]')) return;
    if (!target.closest('[data-ef="insert-zone"]')) {
      moveInputToSlot(pills.length);
      return;
    }
    showAndFocusInput();
  }

  return (
    <div
      ref={rootRef}
      className={[
        styles.root,
        props.className,
        focused || keepSuggestionsVisible ? styles.expanded : "",
      ]
        .filter(Boolean)
        .join(" ")}
      tabIndex={0}
      data-color-scheme={props.colorScheme ?? "auto"}
      onKeyDown={onRootKeyDown}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      <div
        className={[
          styles.frameWrap,
          props.suggestionsDropdownSticky ? styles.stickyFrameWrap : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.frame} onMouseDown={handleFrameMouseDown}>
          <div
            className={styles.leftIcon}
            aria-hidden="true"
            data-ef={aiConfig ? "left-ai-icon" : "left-filter-icon"}
          >
            {aiConfig ? <AiIcon /> : (pills.length > 0 ? <SearchIcon /> : <HourglassIcon />)}
          </div>
          <PillsArea
            pillsAreaRef={pillsAreaRef}
            inputRef={inputRef}
            onInputKeyDown={onInputKeyDown}
            onInputPaste={onInputPaste}
            onMoveInputToSlot={moveInputToSlot}
            onFocusRoot={focusRoot}
          />
          {(pills.length > 0 || inputValue) && (
            <GhostButton
              data-size="icon-sm"
              className={styles.clear}
              type="button"
              data-ef="clear"
              onClick={clearAll}
            >
              ×
            </GhostButton>
          )}
        </div>
        {aiError && <div className={styles.aiError}>{aiError}</div>}
        <MatchDropdown
          matches={matches}
          onPick={pickMatch}
          maxHeight={props.matchDropdownMaxHeight}
          forceVisible={Boolean(props.suggestionsDropdownSticky)}
        />
        <HintPanel
          onPickHint={handlePickHint}
          onPickOperator={insertOperator}
          onInsertField={insertFieldName}
          onInsertLogical={commitInput}
          aiMode={false}
          onAiAppendText={() => undefined}
          maxHeight={props.hintPanelMaxHeight}
          hintColumns={props.hintColumns}
          hintVirtualized={props.hintVirtualized}
          forceVisible={Boolean(props.suggestionsDropdownSticky)}
        />
      </div>
    </div>
  );
}

function AgGridFilterSync(props: Pick<AiFilterProps, "agGrid" | "onFilterChange">): null {
  const pills = useDataSelector((s) => s.pills);
  const fields = useConfigSelector((s) => s.fields);

  useEffect(() => {
    if (!props.agGrid) return;
    syncAgGridExternalFilter({
      api: props.agGrid,
      pills,
      fields,
      onFilterChange: props.onFilterChange,
    });
  }, [props.agGrid, props.onFilterChange, pills, fields]);

  return null;
}

export function AiFilter(props: AiFilterProps): JSX.Element {
  const resolvedFields = useMemo(() => {
    if (!props.agGrid) return props.fields ?? [];
    const agGridFields = fieldsFromAgGrid(props.agGrid);
    return mergeWithAgGridFields(agGridFields, props.fields);
  }, [props.agGrid, props.fields]);

  return (
    <AiFilterProvider {...props} fields={resolvedFields}>
      <AgGridFilterSync agGrid={props.agGrid} onFilterChange={props.onFilterChange} />
      <CoreFilter
        className={props.className}
        ai={props.ai}
        colorScheme={props.colorScheme}
        matchDropdownMaxHeight={props.matchDropdownMaxHeight}
        suggestionsDropdownSticky={props.suggestionsDropdownSticky}
        hintPanelMaxHeight={props.hintPanelMaxHeight}
        hintColumns={props.hintColumns}
        matchRanking={props.matchRanking}
        hintVirtualized={props.hintVirtualized}
      />
    </AiFilterProvider>
  );
}

