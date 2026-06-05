import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Returns a ref that, whenever `isActive` becomes true, calls
 * `scrollIntoView({ block: "nearest" })` on the attached element.
 */
export function useScrollIntoViewWhenActive<T extends Element>(
  isActive: boolean,
): RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isActive]);
  return ref;
}
