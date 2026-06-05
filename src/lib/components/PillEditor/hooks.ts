import type { MutableRefObject, RefObject } from "react";
import { useEffect, useMemo } from "react";

export function useSetFilteredOptions(
  fieldType: string,
  options: string[],
  query: string,
): string[] {
  return useMemo(() => {
    if (fieldType !== "set") return [];
    return options.filter((opt) => opt.toLowerCase().includes(query));
  }, [fieldType, options, query]);
}

export function useResetSuggestionIndex(value: string, setSuggestionIndex: (next: number) => void): void {
  useEffect(() => {
    setSuggestionIndex(0);
  }, [value, setSuggestionIndex]);
}

export function useLookupChange(
  fieldType: string,
  input: string,
  onLookupChange?: (text: string) => void,
): void {
  useEffect(() => {
    if (fieldType !== "set") return;
    onLookupChange?.(input);
    // onLookupChange is intentionally excluded because callers may pass inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldType, input]);
}

export function usePortalBlurGuard(args: {
  valuesPortalRef: RefObject<HTMLDivElement | null>;
  suggestionsPortalRef: RefObject<HTMLDivElement | null>;
  skipNextBlurRef: MutableRefObject<boolean>;
  inputRef: RefObject<HTMLInputElement | null>;
}): void {
  const { valuesPortalRef, suggestionsPortalRef, skipNextBlurRef, inputRef } = args;

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

    function handleDocMouseUp(): void {
      if (!skipNextBlurRef.current) return;
      inputRef.current?.focus();
    }

    document.addEventListener("mousedown", handleDocMouseDown, true);
    document.addEventListener("mouseup", handleDocMouseUp, true);

    return () => {
      document.removeEventListener("mousedown", handleDocMouseDown, true);
      document.removeEventListener("mouseup", handleDocMouseUp, true);
    };
  }, [inputRef, skipNextBlurRef, suggestionsPortalRef, valuesPortalRef]);
}