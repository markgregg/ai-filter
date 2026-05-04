import { normalizePills } from "../../parser";
import type { FilterPill } from "../../types";

export function reorderPillsForDrop(
  pills: FilterPill[],
  from: number,
  slot: number,
): FilterPill[] {
  const next = [...pills];
  const [moved] = next.splice(from, 1);
  if (!moved) return pills;

  let target = slot;
  if (from < target) target -= 1;
  next.splice(target, 0, moved);
  return normalizePills(next);
}
