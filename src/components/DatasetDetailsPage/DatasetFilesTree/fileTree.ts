export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder" | "database" | "schema" | "table" | "excel-sheet";
  children?: FileNode[];
  extension?: string;
}

export function findFileTreeNode(
  nodes: FileNode[],
  matches: (node: FileNode) => boolean,
): FileNode | undefined {
  for (const node of nodes) {
    if (matches(node)) return node;
    if (node.children) {
      const found = findFileTreeNode(node.children, matches);
      if (found) return found;
    }
  }
  return undefined;
}
