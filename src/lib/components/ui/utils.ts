import type { MouseEvent } from "react";

/** Pass directly as `onMouseDown` to prevent focus loss when clicking overlay buttons. */
export function preventDefaultMouseDown(e: MouseEvent): void {
  e.preventDefault();
}

/** Joins truthy class names with a space — a lightweight alternative to clsx. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
