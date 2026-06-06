import { describe, expect, it } from "vitest";
import {
  collectTreeLeafValues,
  findTreeNodeByValue,
  flattenTreeNodes,
  maxTreeDepth,
  topLevelTreeHints,
} from "./tree";
import type { TreeValueNode } from "./types";

const CITY_TREE: TreeValueNode[] = [
  {
    value: "Europe",
    children: [
      { value: "Germany", children: [{ value: "Berlin" }, { value: "Munich" }] },
      { value: "Great Britain", children: [{ value: "London" }, { value: "Manchester" }] },
    ],
  },
  {
    value: "Asia",
    children: [{ value: "China", children: [{ value: "Hong Kong" }] }],
  },
];

describe("tree helpers", () => {
  it("collectTreeLeafValues returns leaf values for parent nodes", () => {
    expect(collectTreeLeafValues(CITY_TREE[0])).toEqual(["Berlin", "Munich", "London", "Manchester"]);
  });

  it("collectTreeLeafValues returns single value for leaves", () => {
    expect(collectTreeLeafValues({ value: "Berlin" })).toEqual(["Berlin"]);
  });

  it("flattenTreeNodes includes node level and leaf flags", () => {
    const flat = flattenTreeNodes(CITY_TREE);
    const europe = flat.find((node) => node.value === "Europe");
    const berlin = flat.find((node) => node.value === "Berlin");
    expect(europe?.isLeaf).toBe(false);
    expect(europe?.level).toBe(1);
    expect(berlin?.isLeaf).toBe(true);
    expect(berlin?.level).toBe(3);
  });

  it("topLevelTreeHints returns list hints for parents with multiple leaves", () => {
    const hints = topLevelTreeHints(CITY_TREE);
    const europe = hints.find((hint) => hint.text === "Europe");
    expect(europe?.kind).toBe("list");
  });

  it("topLevelTreeHints returns single hint when top level has a single leaf", () => {
    const hints = topLevelTreeHints([{ value: "Only", children: [{ value: "Leaf" }] }]);
    expect(hints[0]).toMatchObject({ kind: "single", value: "Leaf" });
  });

  it("findTreeNodeByValue finds exact value case-insensitively", () => {
    const node = findTreeNodeByValue(CITY_TREE, "gErMaNy");
    expect(node?.value).toBe("Germany");
  });

  it("findTreeNodeByValue returns undefined when not found", () => {
    expect(findTreeNodeByValue(CITY_TREE, "Atlantis")).toBeUndefined();
  });

  it("maxTreeDepth handles empty and nested trees", () => {
    expect(maxTreeDepth([])).toBe(0);
    expect(maxTreeDepth(CITY_TREE)).toBe(3);
  });
});
