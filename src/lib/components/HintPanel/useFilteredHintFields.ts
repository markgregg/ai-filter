import { useMemo } from "react";
import type { FieldDefinition } from "../../types";

function fieldLabel(field: FieldDefinition): string {
  return (field.label ?? field.name).toLowerCase();
}

export function useFilteredHintFields(args: {
  rawFields: FieldDefinition[];
  hintFieldSearch?: boolean;
  searchText: string;
}): FieldDefinition[] {
  const { rawFields, hintFieldSearch, searchText } = args;

  return useMemo(() => {
    const sorted = [...rawFields].sort((a, b) => {
      const aOrder = a.hintOrder ?? Number.POSITIVE_INFINITY;
      const bOrder = b.hintOrder ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return rawFields.indexOf(a) - rawFields.indexOf(b);
    });

    if (!hintFieldSearch) return sorted;
    const needle = searchText.trim().toLowerCase();
    if (!needle) return sorted;

    return sorted.filter((field) => fieldLabel(field).includes(needle));
  }, [rawFields, hintFieldSearch, searchText]);
}