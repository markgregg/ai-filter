import type { ReactNode, RefObject } from "react";
import { forwardRef, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Renders `children` in a portal attached to `document.body`, positioned
 * directly below the element referenced by `anchorRef`.
 * Repositions by directly mutating the container's style — no setState, no
 * re-render loop.
 *
 * Forwards its ref to the container div so callers can detect clicks inside
 * the portal (e.g. to prevent input blur).
 */
export const PortalDropdown = forwardRef<HTMLDivElement, {
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  zIndex?: number;
}>(function PortalDropdown(props, forwardedRef) {
  const { anchorRef, zIndex = 200 } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);

  function reposition(): void {
    const anchor = anchorRef.current;
    const container = containerRef.current;
    if (!anchor || !container) return;
    const rect = anchor.getBoundingClientRect();
    container.style.top = `${rect.bottom + 3}px`;
    container.style.left = `${rect.left}px`;
    container.style.minWidth = `${Math.max(rect.width, 140)}px`;
  }

  useEffect(() => {
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={(el) => {
        containerRef.current = el;
        if (typeof forwardedRef === "function") {
          forwardedRef(el);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }
      }}
      style={{ position: "fixed", zIndex }}
    >
      {props.children}
    </div>,
    document.body,
  );
});