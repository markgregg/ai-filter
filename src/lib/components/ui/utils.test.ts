import { cx, preventDefaultMouseDown } from "./utils";

describe("ui utils", () => {
  it("cx joins only truthy classes", () => {
    expect(cx("a", false, undefined, "b", null, "c")).toBe("a b c");
    expect(cx()).toBe("");
  });

  it("preventDefaultMouseDown calls preventDefault", () => {
    const preventDefault = vi.fn();
    preventDefaultMouseDown({ preventDefault } as any);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
