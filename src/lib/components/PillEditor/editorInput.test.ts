import { getEditorInputStep, getEditorInputType } from "./editorInput";

describe("editorInput", () => {
  it("maps field types to expected input types", () => {
    expect(getEditorInputType({ type: "datetime" } as any)).toBe("datetime-local");
    expect(getEditorInputType({ type: "date" } as any)).toBe("date");
    expect(getEditorInputType({ type: "integer" } as any)).toBe("number");
    expect(getEditorInputType({ type: "float" } as any)).toBe("number");
    expect(getEditorInputType({ type: "string" } as any)).toBe("text");
  });

  it("returns numeric step for float only", () => {
    expect(getEditorInputStep({ type: "float" } as any)).toBe("any");
    expect(getEditorInputStep({ type: "integer" } as any)).toBeUndefined();
    expect(getEditorInputStep({ type: "string" } as any)).toBeUndefined();
  });
});
