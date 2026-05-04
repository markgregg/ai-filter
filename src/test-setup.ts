import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cleanup React trees after each test.
afterEach(() => {
  cleanup();
});

// The following stubs are only needed in jsdom environments.
if (typeof window !== "undefined") {
  // jsdom does not implement scrollIntoView — stub it out.
  window.HTMLElement.prototype.scrollIntoView = function () {};

  // jsdom does not implement getAnimations — stub for @base-ui/react ScrollArea.
  window.Element.prototype.getAnimations = function () { return []; };

  // jsdom does not implement ResizeObserver — stub it out.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverStub;

  // Stub navigator.clipboard to avoid errors in test environments.
  Object.defineProperty(window.navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
    },
    writable: true,
    configurable: true,
  });
}
