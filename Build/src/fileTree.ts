import type { FileTab } from "./types";

export function getDirPath(name: string): string {
  const idx = name.lastIndexOf("/");
  return idx >= 0 ? name.slice(0, idx) : "";
}

export function getBaseName(name: string): string {
  const idx = name.lastIndexOf("/");
  return idx >= 0 ? name.slice(idx + 1) : name;
}

export interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  file?: FileTab;
  children: TreeNode[];
}

export function sortTreeNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  for (const n of nodes) {
    if (!n.isFile) sortTreeNodes(n.children);
  }
}

export function buildFileTree(files: FileTab[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.name.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1;
      const part = parts[i];
      if (!part) continue;
      const fullPath = parts.slice(0, i + 1).join("/");

      let existing = current.find((n) => n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: fullPath,
          isFile,
          children: [],
        };
        if (isFile) existing.file = file;
        current.push(existing);
      } else if (isFile) {
        existing.isFile = true;
        existing.file = file;
      }
      if (!isFile) {
        current = existing.children;
      }
    }
  }

  sortTreeNodes(root);
  return root;
}
