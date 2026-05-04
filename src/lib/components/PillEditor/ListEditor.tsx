import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { GhostButton } from "../ui/GhostButton";
import { EfInput } from "../ui/EfInput";
import { isValidValue } from "../../operators";
import { parseEditorRaw } from "./PillEditor";
import { usePillEditorSelector } from "./PillEditorContext";
import { PortalDropdown } from "./PortalDropdown";
import styles from "./PillEditor.module.css";

// ─── ListValueItem ────────────────────────────────────────────────────────────

function ListValueItem(props: {
  value: unknown;
  isEditing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}): JSX.Element {
  function handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
  }

  function handleClick(): void {
    props.onEdit();
  }

  function handleDeleteMouseDown(e: MouseEvent): void {
    e.stopPropagation();
    e.preventDefault();
  }

  function handleDeleteClick(e: MouseEvent): void {
    e.stopPropagation();
    props.onRemove();
  }

  return (
    <div
      className={`${styles.listItem}${props.isEditing ? ` ${styles.listItemEditing}` : ""}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <span className={styles.listItemText}>{String(props.value)}</span>
      <GhostButton
        data-size="icon-sm"
        type="button"
        className={styles.listItemDelete}
        onMouseDown={handleDeleteMouseDown}
        onClick={handleDeleteClick}
        aria-label={`Remove ${String(props.value)}`}
      >
        ×
      </GhostButton>
    </div>
  );
}

// ─── ListSuggestionItem ───────────────────────────────────────────────────────

function ListSuggestionItem(props: {
  option: string;
  isActive: boolean;
  onSelect: () => void;
}): JSX.Element {
  function handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
  }

  function handleClick(): void {
    props.onSelect();
  }

  return (
    <GhostButton
      type="button"
      className={`${styles.suggestion}${props.isActive ? ` ${styles.active}` : ""}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {props.option}
    </GhostButton>
  );
}

// ─── ListEditor ───────────────────────────────────────────────────────────────

export function ListEditor(): JSX.Element {
  const field = usePillEditorSelector((s) => s.field);
  const pill = usePillEditorSelector((s) => s.pill);
  const options = usePillEditorSelector((s) => s.options);
  const onCommit = usePillEditorSelector((s) => s.onCommit);
  const onCancel = usePillEditorSelector((s) => s.onCancel);

  const anchorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const valuesRef = useRef<unknown[]>([]);
  const skipNextBlurRef = useRef(false);
  const valuesPortalRef = useRef<HTMLDivElement | null>(null);
  const suggestionsPortalRef = useRef<HTMLDivElement | null>(null);

  const [values, setValues] = useState<unknown[]>(pill.kind === "list" ? pill.values : []);
  useEffect(() => {
    valuesRef.current = values;
  });
  const [input, setInput] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  // Capture-phase document listener: fires before focus changes, reliably
  // prevents blur when the user clicks inside either portal dropdown.
  useEffect(() => {
    function handleDocMouseDown(e: globalThis.MouseEvent): void {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        valuesPortalRef.current?.contains(target) ||
        suggestionsPortalRef.current?.contains(target)
      ) {
        e.preventDefault();
        skipNextBlurRef.current = true;
      }
    }
    document.addEventListener("mousedown", handleDocMouseDown, true);
    return () => document.removeEventListener("mousedown", handleDocMouseDown, true);
  }, []);

  const inputType: "text" | "number" | "date" | "datetime-local" =
    field.type === "datetime"
      ? "datetime-local"
      : field.type === "date"
        ? "date"
        : field.type === "integer" || field.type === "float"
          ? "number"
          : "text";
  const step = field.type === "float" ? "any" : undefined;

  const query = input.trim().toLowerCase();
  const currentStrings = values.map(String);
  const suggestions =
    field.type === "set"
      ? options.filter((o) => {
          if (!o.toLowerCase().includes(query)) return false;
          // exclude already-selected values, but allow the one being edited
          if (editingIndex !== null && currentStrings[editingIndex] === o) return true;
          return !currentStrings.includes(o);
        })
      : [];

  const showSuggestions = input.trim().length > 0 && suggestions.length > 0;

  function addOrUpdate(rawText: string): void {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    let parsed: unknown;
    if (field.type === "set") {
      const exact = options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
      if (!exact) return; // must match a known option
      parsed = exact;
    } else {
      if (!isValidValue(field, trimmed)) return;
      parsed = parseEditorRaw(field, trimmed);
    }

    const parsedStr = String(parsed);

    if (editingIndex !== null) {
      const i = editingIndex;
      setValues((prev) => {
        const next = [...prev];
        next[i] = parsed;
        return next;
      });
      setEditingIndex(null);
    } else {
      if (currentStrings.includes(parsedStr)) return; // no duplicates
      setValues((prev) => [...prev, parsed]);
    }

    setInput("");
    setSuggestionIndex(0);
    setTimeout(() => { inputRef.current?.focus(); }, 0);
  }

  function startEdit(index: number): void {
    setEditingIndex(index);
    setInput(String(values[index]));
    setSuggestionIndex(0);
  }

  function removeValue(index: number): void {
    if (editingIndex === index) {
      setEditingIndex(null);
      setInput("");
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
    setValues((prev) => prev.filter((_, i) => i !== index));
    setTimeout(() => { inputRef.current?.focus(); }, 0);
  }

  function commitList(): void {
    const current = valuesRef.current;
    if (current.length === 0) {
      onCancel();
      return;
    }
    if (pill.kind === "list") {
      onCommit({ ...pill, values: current });
    }
  }

  function handleBlur(): void {
    if (skipNextBlurRef.current) {
      skipNextBlurRef.current = false;
      // Capture-phase preventDefault should prevent blur, but refocus as safety net
      setTimeout(() => { inputRef.current?.focus(); }, 0);
      return;
    }
    commitList();
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>): void {
    setInput(e.target.value);
    setSuggestionIndex(0);
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    e.stopPropagation();
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIndex((prev) => Math.min(suggestions.length - 1, prev + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const picked = suggestions[suggestionIndex];
        if (picked) addOrUpdate(picked);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (input.trim()) {
        addOrUpdate(input);
      } else {
        commitList();
      }
      return;
    }
    if (e.key === "Escape") {
      if (editingIndex !== null) {
        // Cancel the current edit without cancelling the whole editor
        setEditingIndex(null);
        setInput("");
      } else {
        onCancel();
      }
      return;
    }
    if (e.key === "Backspace" && !input && values.length > 0) {
      removeValue(values.length - 1);
    }
  }

  return (
    <div ref={anchorRef} className={styles.listEditor}>
      <EfInput
        ref={inputRef}
        className={styles.editor}
        type={inputType}
        step={step}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        placeholder={editingIndex !== null ? "edit value…" : "add value…"}
        autoFocus
        onBlur={handleBlur}
      />
      {values.length > 0 && (
        <PortalDropdown ref={valuesPortalRef} anchorRef={anchorRef} zIndex={showSuggestions ? 19 : 20}>
          <div className={styles.listDropdown}>
            {values.map((value, index) => (
              <ListValueItem
                key={index}
                value={value}
                isEditing={editingIndex === index}
                onEdit={() => startEdit(index)}
                onRemove={() => removeValue(index)}
              />
            ))}
          </div>
        </PortalDropdown>
      )}
      {showSuggestions && (
        <PortalDropdown ref={suggestionsPortalRef} anchorRef={anchorRef} zIndex={30}>
          <div className={styles.listSuggestions}>
            {suggestions.map((option, index) => (
              <ListSuggestionItem
                key={option}
                option={option}
                isActive={suggestionIndex === index}
                onSelect={() => addOrUpdate(option)}
              />
            ))}
          </div>
        </PortalDropdown>
      )}
    </div>
  );
}
