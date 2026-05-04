import type { Hint } from "./types";

export function uniqueStringValues(values: readonly unknown[]): string[] {
  return [...new Set(values.map(String))];
}

export function toSingleHints(values: readonly unknown[]): Hint[] {
  return uniqueStringValues(values).map((value) => ({
    kind: "single",
    text: value,
    operator: "=",
    value,
  }));
}

export function hintIdentityKey(hint: Hint): string {
  if (hint.kind === "single") {
    return `single|${String(hint.value)}`;
  }
  if (hint.kind === "list") {
    return `list|${[...hint.values].map(String).sort().join(",")}`;
  }
  return `range|${String(hint.from)}|${String(hint.to)}`;
}

export function dedupeHintsByIdentity(hints: readonly Hint[]): Hint[] {
  const seen = new Set<string>();
  const deduped: Hint[] = [];
  hints.forEach((hint) => {
    const key = hintIdentityKey(hint);
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(hint);
  });
  return deduped;
}

export function inferHintColumns(hintCount: number): number {
  if (hintCount >= 120) return 4;
  if (hintCount >= 48) return 3;
  if (hintCount >= 24) return 2;
  return 1;
}
