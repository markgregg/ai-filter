// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { PortalDropdown } from "./PortalDropdown";

describe("PortalDropdown", () => {
  it("renders into document.body and positions from anchor", () => {
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);
    const anchorRef = { current: anchor };

    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      x: 10,
      y: 20,
      top: 20,
      left: 10,
      bottom: 40,
      right: 110,
      width: 100,
      height: 20,
      toJSON: () => ({}),
    } as DOMRect);

    render(
      <PortalDropdown anchorRef={anchorRef} zIndex={321}>
        <div>dropdown-content</div>
      </PortalDropdown>,
    );

    const content = screen.getByText("dropdown-content");
    const container = content.parentElement as HTMLDivElement;

    expect(container.style.position).toBe("fixed");
    expect(container.style.zIndex).toBe("321");
    expect(container.style.top).toBe("43px");
    expect(container.style.left).toBe("10px");
    expect(container.style.minWidth).toBe("140px");
  });

  it("forwards the container ref", () => {
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const forwarded = createRef<HTMLDivElement>();

    render(
      <PortalDropdown ref={forwarded} anchorRef={{ current: anchor }}>
        <div>x</div>
      </PortalDropdown>,
    );

    expect(forwarded.current).toBeInstanceOf(HTMLDivElement);
  });
});
