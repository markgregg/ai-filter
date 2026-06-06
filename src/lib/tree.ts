import type { Hint, TreeValueNode } from "./types";

export type FlatTreeNode = {
  value: string;
  level: number;
  isLeaf: boolean;
  leafValues: string[];
};

export function collectTreeLeafValues(node: TreeValueNode): string[] {
  if (!node.children?.length) return [node.value];
  return node.children.flatMap(collectTreeLeafValues);
}

export function flattenTreeNodes(nodes: TreeValueNode[], level = 1): FlatTreeNode[] {
  return nodes.flatMap((node) => {
    const current: FlatTreeNode = {
      value: node.value,
      level,
      isLeaf: !node.children?.length,
      leafValues: collectTreeLeafValues(node),
    };
    const children = node.children?.length ? flattenTreeNodes(node.children, level + 1) : [];
    return [current, ...children];
  });
}

export function topLevelTreeHints(nodes: TreeValueNode[]): Hint[] {
  return nodes.map((node) => {
    const leafValues = collectTreeLeafValues(node);
    if (leafValues.length <= 1) {
      return {
        kind: "single" as const,
        text: node.value,
        operator: "=",
        value: leafValues[0] ?? node.value,
      };
    }
    return {
      kind: "list" as const,
      text: node.value,
      operator: "=",
      values: leafValues,
    };
  });
}

export function findTreeNodeByValue(nodes: TreeValueNode[], value: string): TreeValueNode | undefined {
  const needle = value.toLowerCase();
  for (const node of nodes) {
    if (node.value.toLowerCase() === needle) return node;
    if (node.children?.length) {
      const child = findTreeNodeByValue(node.children, value);
      if (child) return child;
    }
  }
  return undefined;
}

export function maxTreeDepth(nodes: TreeValueNode[], level = 1): number {
  if (!nodes.length) return 0;
  return Math.max(
    ...nodes.map((node) => {
      if (!node.children?.length) return level;
      return maxTreeDepth(node.children, level + 1);
    }),
  );
}
