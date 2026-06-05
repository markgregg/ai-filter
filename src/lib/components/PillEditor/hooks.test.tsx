// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import {
  useLookupChange,
  usePortalBlurGuard,
  useResetSuggestionIndex,
  useSetFilteredOptions,
} from "./hooks";

describe("PillEditor hooks", () => {
  it("useSetFilteredOptions filters only set fields", () => {
    const { result, rerender } = renderHook(
      ({ type, opts, query }) => useSetFilteredOptions(type, opts, query),
      {
        initialProps: { type: "set", opts: ["Alpha", "Beta", "Gamma"], query: "a" },
      },
    );

    expect(result.current).toEqual(["Alpha", "Beta", "Gamma"]);

    rerender({ type: "string", opts: ["Alpha"], query: "a" });
    expect(result.current).toEqual([]);
  });

  it("useResetSuggestionIndex resets when value changes", () => {
    const setSuggestionIndex = vi.fn();
    const { rerender } = renderHook(
      ({ value }) => useResetSuggestionIndex(value, setSuggestionIndex),
      { initialProps: { value: "a" } },
    );

    expect(setSuggestionIndex).toHaveBeenCalledWith(0);
    rerender({ value: "abc" });
    expect(setSuggestionIndex).toHaveBeenCalledTimes(2);
  });

  it("useLookupChange invokes callback for set fields only", () => {
    const onLookupChange = vi.fn();
    const { rerender } = renderHook(
      ({ type, input }) => useLookupChange(type, input, onLookupChange),
      { initialProps: { type: "set", input: "foo" } },
    );

    expect(onLookupChange).toHaveBeenCalledWith("foo");

    rerender({ type: "string", input: "bar" });
    expect(onLookupChange).toHaveBeenCalledTimes(1);
  });

  it("usePortalBlurGuard prevents blur and refocuses when clicking portal", () => {
    const valuesPortal = document.createElement("div");
    const suggestionsPortal = document.createElement("div");
    const portalChild = document.createElement("button");
    valuesPortal.appendChild(portalChild);
    document.body.appendChild(valuesPortal);
    document.body.appendChild(suggestionsPortal);

    const input = document.createElement("input");
    const focusSpy = vi.spyOn(input, "focus");

    const { result } = renderHook(() => {
      const valuesPortalRef = useRef<HTMLDivElement | null>(valuesPortal);
      const suggestionsPortalRef = useRef<HTMLDivElement | null>(suggestionsPortal);
      const skipNextBlurRef = useRef(false);
      const inputRef = useRef<HTMLInputElement | null>(input);

      usePortalBlurGuard({ valuesPortalRef, suggestionsPortalRef, skipNextBlurRef, inputRef });

      return { skipNextBlurRef };
    });

    act(() => {
      portalChild.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(result.current.skipNextBlurRef.current).toBe(true);
    expect(focusSpy).toHaveBeenCalled();

    valuesPortal.remove();
    suggestionsPortal.remove();

    focusSpy.mockRestore();
  });
});
