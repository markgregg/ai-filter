// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiFilter } from "../../index";
import type { AgGridApi, FieldDefinition } from "../../types";

describe("AiFilter agGrid integration", () => {
  it("rebuilds AG Grid external filter and notifies onFilterChange when pills change", async () => {
    const options = new Map<string, unknown>();

    const agGrid: AgGridApi = {
      setGridOption: vi.fn((key: string, value: unknown) => {
        options.set(key, value);
      }),
      onFilterChanged: vi.fn(),
    };

    const onFilterChange = vi.fn();

    const fields: FieldDefinition[] = [
      { name: "count", type: "integer", precedence: 10 },
      { name: "title", type: "string", precedence: 9 },
    ];

    const ui = render(
      <AiFilter
        fields={fields}
        pills={[]}
        agGrid={agGrid}
        onFilterChange={onFilterChange}
        ai={false}
      />,
    );

    ui.rerender(
      <AiFilter
        fields={fields}
        pills={[{ id: "p1", kind: "value", fieldName: "count", operator: ">", value: 5 }]}
        agGrid={agGrid}
        onFilterChange={onFilterChange}
        ai={false}
      />,
    );

    await waitFor(() => {
      expect(agGrid.onFilterChanged).toHaveBeenCalled();
      expect(onFilterChange).toHaveBeenCalled();
    });

    const isPresent = options.get("isExternalFilterPresent") as () => boolean;
    const doesPass = options.get("doesExternalFilterPass") as (node: { data: Record<string, unknown> }) => boolean;

    expect(isPresent()).toBe(true);
    expect(doesPass({ data: { count: 6 } })).toBe(true);
    expect(doesPass({ data: { count: 3 } })).toBe(false);
  });
});