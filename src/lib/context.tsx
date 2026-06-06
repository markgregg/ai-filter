import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { toSingleHints, uniqueStringValues } from "./hints";
import { maxTreeDepth, topLevelTreeHints } from "./tree";
import type { AiFilterProps, FieldDefinition, FilterPill, Hint } from "./types";

type ConfigState = {
  id?: string;
  fields: FieldDefinition[];
  mode: "simple" | "complex";
  hintsEnabled: boolean;
  maxFavorites?: number;
  hintFieldSearch: boolean;
  placeholder?: string;
  aiPlaceholder?: string;
  pillMaxWidth?: string;
  onChange?: (pills: FilterPill[]) => void;
  onClear?: () => void;
};

type DataState = {
  pills: FilterPill[];
  setPills: (updater: FilterPill[] | ((prev: FilterPill[]) => FilterPill[])) => void;
  setValuesByField: Record<string, string[]>;
  hintsByField: Record<string, Hint[]>;
  recentByField: Record<string, unknown[]>;
  favoritesByField: Record<string, unknown[]>;
  favoriteCountsByField: Record<string, Record<string, number>>;
  favoriteFieldCounts: Record<string, number>;
  loadSetValues: (field: FieldDefinition, lookupText?: string) => Promise<string[]>;
  loadHints: (field: FieldDefinition) => Promise<Hint[]>;
  rememberValue: (fieldName: string, value: unknown) => void;
};

type UiState = {
  focused: boolean;
  inputValue: string;
  hintValueFilterText: string;
  insertIndex: number;
  selectedIds: string[];
  editingId?: string;
  activeField?: string;
  highlightIndex: number;
  setFocused: (next: boolean) => void;
  setInputValue: (next: string) => void;
  setHintValueFilterText: (next: string) => void;
  setInsertIndex: (next: number) => void;
  setSelectedIds: (next: string[]) => void;
  setEditingId: (next?: string) => void;
  setActiveField: (next?: string) => void;
  setHighlightIndex: (next: number) => void;
};

const ConfigContext = createContext<ConfigState | null>(null);
const DataContext = createContext<DataState | null>(null);
const UiContext = createContext<UiState | null>(null);

function keyForRecent(id?: string): string | undefined {
  if (!id) return undefined;
  return `ai-filter:${id}:recent`;
}

function readRecent(id?: string): Record<string, unknown[]> {
  const key = keyForRecent(id);
  if (!key) return {};

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown[]>;
    }
  } catch {
    return {};
  }

  return {};
}

function writeRecent(id: string | undefined, value: Record<string, unknown[]>): void {
  const key = keyForRecent(id);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function keyForFavorites(id?: string): string | undefined {
  if (!id) return undefined;
  return `ai-filter:${id}:favorites`;
}

function readFavorites(id?: string): Record<string, Record<string, number>> {
  const key = keyForFavorites(id);
  if (!key) return {};

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, Record<string, number>>;
    }
  } catch {
    return {};
  }

  return {};
}

function writeFavorites(id: string | undefined, value: Record<string, Record<string, number>>): void {
  const key = keyForFavorites(id);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function AiFilterProvider({
  children,
  id,
  fields = [],
  pills,
  onChange,
  onClear,
  mode = "complex",
  hintsEnabled = true,
  maxFavorites,
  hintFieldSearch = false,
  placeholder,
  aiPlaceholder,
  pillMaxWidth,
}: PropsWithChildren<AiFilterProps>): JSX.Element {
  const [internalPills, setInternalPills] = useState<FilterPill[]>(pills ?? []);
  const [setValuesByField, setSetValuesByField] = useState<Record<string, string[]>>({});
  const [hintsByField, setHintsByField] = useState<Record<string, Hint[]>>({});
  const [recentByField, setRecentByField] = useState<Record<string, unknown[]>>(() =>
    readRecent(id),
  );
  const [favoriteCountsByField, setFavoriteCountsByField] = useState<Record<string, Record<string, number>>>(() =>
    maxFavorites !== undefined ? readFavorites(id) : {},
  );

  const [focused, setFocused] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [hintValueFilterText, setHintValueFilterText] = useState("");
  const [insertIndex, setInsertIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [activeField, setActiveField] = useState<string | undefined>();
  const [highlightIndex, setHighlightIndex] = useState(0);

  // Debounce support: timers and pending resolvers keyed by field name.
  type Waiter<T> = { resolve: (v: T) => void; reject: (e: unknown) => void };
  const setValuesTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const setValuesSeqRef = useRef<Record<string, number>>({});
  const setValuesByFieldRef = useRef<Record<string, string[]>>({});
  const setValuesAbortRef = useRef<Record<string, AbortController | undefined>>({});
  const setValuesRequestRef = useRef<Record<string, Promise<string[]>>>({});
  const setValuesPendingDebounceRef = useRef<Record<string, {
    key: string;
    resolve: (values: string[]) => void;
  } | undefined>>({});
  const hintsTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const hintsPendingRef = useRef<Record<string, Array<Waiter<Hint[]>>>>({});
  const hintsAbortRef = useRef<Record<string, AbortController | undefined>>({});
  const hintSourceByFieldRef = useRef<Record<string, FieldDefinition["hints"] | undefined>>({});

  useEffect(() => {
    setValuesByFieldRef.current = setValuesByField;
  }, [setValuesByField]);

  useEffect(() => {
    if (pills) {
      setInternalPills(pills);
    }
  }, [pills]);

  useEffect(() => {
    setInsertIndex(internalPills.length);
  }, [internalPills.length]);

  useEffect(() => {
    writeRecent(id, recentByField);
  }, [id, recentByField]);

  useEffect(() => {
    if (maxFavorites === undefined) {
      setFavoriteCountsByField({});
      return;
    }
    setFavoriteCountsByField(readFavorites(id));
  }, [id, maxFavorites]);

  useEffect(() => {
    if (maxFavorites === undefined) return;
    writeFavorites(id, favoriteCountsByField);
  }, [id, maxFavorites, favoriteCountsByField]);

  useEffect(() => {
    // Keep static set-values available immediately without calling async sources.
    const staticValues = fields.reduce<Record<string, string[]>>((acc, field) => {
      if (field.type !== "set") return acc;
      if (!Array.isArray(field.setValues)) return acc;
      acc[field.name] = field.setValues;
      return acc;
    }, {});

    if (!Object.keys(staticValues).length) return;
    setSetValuesByField((prev) => ({ ...prev, ...staticValues }));
  }, [fields]);

  useEffect(() => {
    const previous = hintSourceByFieldRef.current;
    const next: Record<string, FieldDefinition["hints"] | undefined> = {};
    const changedNames = new Set<string>();

    for (const field of fields) {
      next[field.name] = field.hints;
      if (previous[field.name] !== field.hints) {
        changedNames.add(field.name);
      }
    }

    for (const fieldName of Object.keys(previous)) {
      if (!(fieldName in next)) {
        changedNames.add(fieldName);
      }
    }

    hintSourceByFieldRef.current = next;
    if (changedNames.size === 0) return;

    setHintsByField((prev) => {
      const filtered = { ...prev };
      changedNames.forEach((name) => {
        delete filtered[name];
      });
      return filtered;
    });
  }, [fields]);

  useEffect(() => {
    // Sync async set-value query results into hintsByField for "fieldValues" hint sources.
    // This ensures the hint panel stays up-to-date after the user types a lookup query.
    const updates: Record<string, Hint[]> = {};
    for (const field of fields) {
      if (field.type !== "set") continue;
      if (field.hints !== "fieldValues") continue;
      if (Array.isArray(field.setValues)) continue; // static fields handled by loadHints directly
      const values = setValuesByField[field.name];
      if (values === undefined) continue;
      updates[field.name] = toSingleHints(uniqueStringValues(values));
    }
    if (Object.keys(updates).length > 0) {
      setHintsByField((prev) => ({ ...prev, ...updates }));
    }
  }, [fields, setValuesByField]);

  const setPills = useCallback(
    (updater: FilterPill[] | ((prev: FilterPill[]) => FilterPill[])) => {
      setInternalPills((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  const loadSetValues = useCallback(
    async (field: FieldDefinition, lookupText = ""): Promise<string[]> => {
      if (field.type !== "set") return [];
      const source = field.setValues;
      const debounceMs = field.setValuesDebounceMs ?? 0;
      const lookupMinChars = field.lookupMinChars ?? 0;
      const normalizedLookupText = lookupText.trim();

      if (!source) return [];
      if (normalizedLookupText.length < lookupMinChars) return [];

      // Static set arrays are immediate and not query-driven.
      if (Array.isArray(source)) {
        setSetValuesByField((prev) => ({ ...prev, [field.name]: source }));
        return source;
      }

      const requestKey = `${field.name}::${normalizedLookupText}`;
      const existingRequest = setValuesRequestRef.current[requestKey];
      if (existingRequest) {
        return existingRequest;
      }

      // Async set source: called only for lookup input text, debounced.
      const nextSeq = (setValuesSeqRef.current[field.name] ?? 0) + 1;
      setValuesSeqRef.current[field.name] = nextSeq;

      const request = new Promise<string[]>((resolve, reject) => {
        const pending = setValuesPendingDebounceRef.current[field.name];
        if (pending && pending.key !== requestKey) {
          pending.resolve(setValuesByFieldRef.current[field.name] ?? []);
          delete setValuesRequestRef.current[pending.key];
        }

        clearTimeout(setValuesTimerRef.current[field.name]);
        setValuesPendingDebounceRef.current[field.name] = { key: requestKey, resolve };
        setValuesTimerRef.current[field.name] = setTimeout(() => {
          setValuesPendingDebounceRef.current[field.name] = undefined;
          setValuesAbortRef.current[field.name]?.abort();
          const controller = new AbortController();
          setValuesAbortRef.current[field.name] = controller;

          const runSource = source as (lookup: string, signal?: AbortSignal) => Promise<string[]>;
          runSource(normalizedLookupText, controller.signal)
            .then((values) => {
              const isLatest = setValuesSeqRef.current[field.name] === nextSeq;
              if (isLatest) {
                setSetValuesByField((prev) => ({ ...prev, [field.name]: values }));
                resolve(values);
                return;
              }

              // Ignore stale async results from earlier lookup requests.
              resolve(setValuesByFieldRef.current[field.name] ?? []);
            })
            .catch((err: unknown) => {
              if (err instanceof Error && err.name === "AbortError") {
                resolve(setValuesByFieldRef.current[field.name] ?? []);
                return;
              }
              const isLatest = setValuesSeqRef.current[field.name] === nextSeq;
              if (!isLatest) {
                resolve(setValuesByFieldRef.current[field.name] ?? []);
                return;
              }
              reject(err);
            })
            .finally(() => {
              delete setValuesRequestRef.current[requestKey];
              const currentController = setValuesAbortRef.current[field.name];
              if (currentController === controller) {
                setValuesAbortRef.current[field.name] = undefined;
              }
            });
        }, debounceMs);
      });

      setValuesRequestRef.current[requestKey] = request;
      return request;
    },
    [],
  );

  const loadHints = useCallback(
    async (field: FieldDefinition): Promise<Hint[]> => {
      const cached = hintsByField[field.name];
      if (cached) return cached;

      if (!hintsEnabled) {
        return [];
      }

      const source = field.hints;
      const debounceMs = field.hintsDebounceMs;
      const isFunctionSource = typeof source === "function";

      async function executeLoad(): Promise<Hint[]> {
        let hints: Hint[] = [];
        if (field.type === "tree") {
          if (maxTreeDepth(field.treeValues) > 5) {
            throw new Error(`Tree field '${field.name}' exceeds maximum depth of 5 levels.`);
          }
          hints = topLevelTreeHints(field.treeValues);
          setHintsByField((prev) => ({ ...prev, [field.name]: hints }));
          return hints;
        }
        if (source === "fieldValues" && field.type === "set") {
          // Do not trigger async set-value providers from hint preloading.
          // Async set-values are lookup-driven and loaded from input typing.
          const rawSetValues =
            Array.isArray(field.setValues)
              ? field.setValues
              : (setValuesByFieldRef.current[field.name] ?? []);
          hints = toSingleHints(uniqueStringValues(rawSetValues));
        } else if (typeof source === "function") {
          hintsAbortRef.current[field.name]?.abort();
          const controller = new AbortController();
          hintsAbortRef.current[field.name] = controller;
          const runSource = source as (signal?: AbortSignal) => Promise<Hint[]>;
          try {
            hints = await runSource(controller.signal);
          } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
              return hintsByField[field.name] ?? [];
            }
            throw err;
          }
        } else if (Array.isArray(source)) {
          hints = source;
        }
        setHintsByField((prev) => ({ ...prev, [field.name]: hints }));
        return hints;
      }

      if (!debounceMs || !isFunctionSource) {
        return executeLoad();
      }

      return new Promise<Hint[]>((resolve, reject) => {
        const pending = hintsPendingRef.current;
        if (!pending[field.name]) pending[field.name] = [];
        pending[field.name].push({ resolve, reject });
        clearTimeout(hintsTimerRef.current[field.name]);
        hintsTimerRef.current[field.name] = setTimeout(() => {
          const waiters = pending[field.name] ?? [];
          delete pending[field.name];
          executeLoad()
            .then((hints) => {
              waiters.forEach(({ resolve: res }) => res(hints));
            })
            .catch((err: unknown) => {
              waiters.forEach(({ reject: rej }) => rej(err));
            });
        }, debounceMs);
      });
    },
    [hintsByField, hintsEnabled],
  );

  const rememberValue = useCallback(
    (fieldName: string, value: unknown) => {
      const valueKey = JSON.stringify(value);
      if (hintsEnabled) {
        setRecentByField((prev) => {
          const list = prev[fieldName] ?? [];
          const without = list.filter((item) => JSON.stringify(item) !== valueKey);
          return {
            ...prev,
            [fieldName]: [value, ...without].slice(0, 10),
          };
        });
      }
      if (maxFavorites !== undefined) {
        setFavoriteCountsByField((prev) => {
          const fieldMap = { ...(prev[fieldName] ?? {}) };
          fieldMap[valueKey] = (fieldMap[valueKey] ?? 0) + 1;
          return {
            ...prev,
            [fieldName]: fieldMap,
          };
        });
      }
    },
    [hintsEnabled, maxFavorites],
  );

  const favoritesByField = useMemo<Record<string, unknown[]>>(() => {
    if (maxFavorites === undefined) return {};
    const out: Record<string, unknown[]> = {};
    for (const [fieldName, counts] of Object.entries(favoriteCountsByField)) {
      const values = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(0, maxFavorites))
        .map(([encoded]) => {
          try {
            return JSON.parse(encoded) as unknown;
          } catch {
            return encoded;
          }
        });
      out[fieldName] = values;
    }
    return out;
  }, [favoriteCountsByField, maxFavorites]);

  const favoriteFieldCounts = useMemo<Record<string, number>>(() => {
    if (maxFavorites === undefined) return {};
    const out: Record<string, number> = {};
    for (const [fieldName, counts] of Object.entries(favoriteCountsByField)) {
      out[fieldName] = Object.values(counts).reduce((sum, c) => sum + c, 0);
    }
    return out;
  }, [favoriteCountsByField, maxFavorites]);

  const configValue = useMemo<ConfigState>(
    () => ({
      id,
      fields,
      mode,
      hintsEnabled,
      maxFavorites,
      hintFieldSearch,
      placeholder,
      aiPlaceholder,
      pillMaxWidth,
      onChange,
      onClear,
    }),
    [id, fields, mode, hintsEnabled, maxFavorites, hintFieldSearch, placeholder, aiPlaceholder, pillMaxWidth, onChange, onClear],
  );

  const dataValue = useMemo<DataState>(
    () => ({
      pills: internalPills,
      setPills,
      setValuesByField,
      hintsByField,
      recentByField,
      favoritesByField,
      favoriteCountsByField,
      favoriteFieldCounts,
      loadSetValues,
      loadHints,
      rememberValue,
    }),
    [
      internalPills,
      setPills,
      setValuesByField,
      hintsByField,
      recentByField,
      favoritesByField,
      favoriteCountsByField,
      favoriteFieldCounts,
      loadSetValues,
      loadHints,
      rememberValue,
    ],
  );

  const uiValue = useMemo<UiState>(
    () => ({
      focused,
      inputValue,
      hintValueFilterText,
      insertIndex,
      selectedIds,
      editingId,
      activeField,
      highlightIndex,
      setFocused,
      setInputValue,
      setHintValueFilterText,
      setInsertIndex,
      setSelectedIds,
      setEditingId,
      setActiveField,
      setHighlightIndex,
    }),
    [
      focused,
      inputValue,
      hintValueFilterText,
      insertIndex,
      selectedIds,
      editingId,
      activeField,
      highlightIndex,
    ],
  );

  return (
    <ConfigContext.Provider value={configValue}>
      <DataContext.Provider value={dataValue}>
        <UiContext.Provider value={uiValue}>{children}</UiContext.Provider>
      </DataContext.Provider>
    </ConfigContext.Provider>
  );
}

function requireContext<T>(value: T | null, name: string): T {
  if (!value) {
    throw new Error(`${name} not found. Use inside AiFilterProvider.`);
  }
  return value;
}

export function useConfigSelector<T>(selector: (ctx: ConfigState) => T): T {
  return useContextSelector(ConfigContext, (value) => selector(requireContext(value, "ConfigContext")));
}

export function useDataSelector<T>(selector: (ctx: DataState) => T): T {
  return useContextSelector(DataContext, (value) => selector(requireContext(value, "DataContext")));
}

export function useUiSelector<T>(selector: (ctx: UiState) => T): T {
  return useContextSelector(UiContext, (value) => selector(requireContext(value, "UiContext")));
}
