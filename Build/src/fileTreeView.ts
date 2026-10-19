import type { FileTab } from "./types";
import { buildFileTree, sortTreeNodes, type TreeNode } from "./fileTree";
import { activeFileState, filesState } from "./appState";

const FILE_ICONS: Record<string, string> = {
  html: "fab fa-html5", htm: "fab fa-html5",
  css: "fab fa-css3-alt",
  js: "fab fa-js", mjs: "fab fa-js", cjs: "fab fa-js",
  jsx: "fab fa-react",
  ts: "fab fa-js", tsx: "fab fa-react",
  json: "fas fa-brackets-curly",
};

export function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] || "far fa-file-code";
}

/** Folders currently expanded in the sidebar tree. */
export const expandedFolders = new Set<string>();

export function renderFileTabs(
  container: HTMLElement,
  files: FileTab[],
  activeId: string,
): void {
  container.innerHTML = "";

  for (const file of files) {
    // Folder placeholders exist only to keep empty folders in the tree.
    if (file.name.endsWith("/.gitkeep")) continue;

    const tab = document.createElement("div");
    tab.className = `file-tab${file.id === activeId ? " active" : ""}`;
    tab.dataset["file"] = file.id;

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-tab-name";
    nameSpan.textContent = file.name;
    tab.appendChild(nameSpan);

    const closeBtn = document.createElement("button");
    closeBtn.className = "file-tab-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.dataset["file"] = file.id;
    tab.appendChild(closeBtn);

    container.appendChild(tab);
  }

  const addBtn = document.createElement("button");
  addBtn.className = "file-tab-add";
  addBtn.innerHTML = "+";
  addBtn.title = "New file";
  container.appendChild(addBtn);
}

export function renderTreeNode(
  node: TreeNode,
  activeId: string,
  depth: number,
): HTMLElement | null {
  if (node.isFile && node.name === ".gitkeep") return null;

  const item = document.createElement("div");

  if (node.isFile) {
    item.className = `file-tree-item${node.file && node.file.id === activeId ? " active" : ""}`;
    item.dataset["file"] = node.file?.id;

    const icon = document.createElement("i");
    const fileName = node.file?.name ?? node.name;
    icon.className = getFileIcon(fileName) + " file-tree-icon";
    item.appendChild(icon);

    const name = document.createElement("span");
    name.className = "file-tree-name";
    name.textContent = node.name;
    item.appendChild(name);
  } else {
    const isOpen = expandedFolders.has(node.path);
    item.className = "file-tree-folder";
    item.dataset["folder"] = node.path;

    const toggle = document.createElement("span");
    toggle.className = "file-tree-toggle";
    toggle.textContent = isOpen ? "▾" : "▸";
    item.appendChild(toggle);

    const icon = document.createElement("i");
    icon.className = "fas fa-folder" + (isOpen ? "-open" : "") + " file-tree-icon";
    item.appendChild(icon);

    const name = document.createElement("span");
    name.className = "file-tree-name";
    name.textContent = node.name;
    item.appendChild(name);

    if (isOpen) {
      const visible = node.children.filter(
        (c) => !(c.isFile && c.name === ".gitkeep"),
      );
      if (visible.length > 0) {
        const children = document.createElement("div");
        children.className = "file-tree-children";
        const sorted = [...visible];
        sortTreeNodes(sorted);
        let hasChild = false;
        for (const child of sorted) {
          const el = renderTreeNode(child, activeId, depth + 1);
          if (el) {
            children.appendChild(el);
            hasChild = true;
          }
        }
        if (hasChild) item.appendChild(children);
      }
    }
  }

  item.style.paddingLeft = `${depth * 16 + 4}px`;
  return item;
}

export function renderFileTree(container: HTMLElement): void {
  const files = filesState.get();
  const activeId = activeFileState.get();

  container.innerHTML = "";

  const root = buildFileTree(files);
  for (const node of root) {
    const el = renderTreeNode(node, activeId, 0);
    if (el) container.appendChild(el);
  }
}
