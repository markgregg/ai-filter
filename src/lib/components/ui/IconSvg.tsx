import type { ReactNode } from "react";

/** Shared SVG root for all 16×16 icon components. */
export function IconSvg({
  strokeWidth,
  children,
}: {
  strokeWidth?: number | string;
  children: ReactNode;
}): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
