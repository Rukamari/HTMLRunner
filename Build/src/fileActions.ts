import JSZip from "jszip";
import { saveAs } from "file-saver";
import { activeFileState, filesState, markStateHydrated } from "./appState";
import { switchToFile } from "./editor";
import {
  getDefaultFiles,
  getLanguageForExt,
  getTemplateForExt,
} from "./defaultContent";
import { deleteFileFromWorker, syncFileToWorker } from "./git-service";
import { showError } from "./ui";
import { expandedFolders } from "./fileTreeView";
import { getDirPath } from "./fileTree";
import type { FileTab } from "./types";

export function switchFileAction(id: string): void {
  const files = filesState.get();
  const file = files.find((f) => f.id === id);
  if (file) switchToFile(file);
}

export function splitFileName(name: string): [string, string] {
  const slash = name.lastIndexOf("/");
  const base = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return [name, ""];
  const stem = name.slice(0, name.length - (base.length - dot));
  return [stem, base.slice(dot)];
}

/** Return a name that doesn't collide with an existing file. */
export function uniqueFileName(files: FileTab[], desired: string): string {
  if (!files.some((f) => f.name === desired)) return desired;
  const [stem, ext] = splitFileName(desired);
  let counter = 2;
  let candidate = `${stem}-${counter}${ext}`;
  while (files.some((f) => f.name === candidate)) {
    counter++;
    candidate = `${stem}-${counter}${ext}`;
  }
  return candidate;
}

function createFile(name: string, content: string): FileTab {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return {
    id: name,
    name,
    content,
    language: getLanguageForExt(ext),
  };
}

function openNewFile(files: FileTab[], fileName: string, content: string): void {
  const newFile = createFile(fileName, content);
  filesState.set([...files, newFile]);
  const file = filesState.get().find((f) => f.id === newFile.id);
  if (file) switchToFile(file);
  syncFileToWorker(fileName, content);
}

/** Restore the demo project and remove the files it replaced. */
export function resetWorkspaceAction(skipConfirmation = false): void {
  if (
    !skipConfirmation &&
    !confirm("Are you sure you want to reset all code?")
  ) {
    return;
  }

  const previous = filesState.get();
  const defaults = getDefaultFiles();
  const defaultIds = new Set(defaults.map((f) => f.id));

  for (const file of previous) {
    if (!defaultIds.has(file.id)) deleteFileFromWorker(file.id);
  }

  filesState.set(defaults);
  for (const file of defaults) {
    syncFileToWorker(file.id, file.content);
  }

  const first = defaults[0];
  if (first) {
    activeFileState.set(first.id);
    switchToFile(first, false);
  }

  markStateHydrated();
}

export function addFileAction(): void {
  const name = prompt("Enter filename (use / for folders):", "untitled.html");
  if (!name || !name.trim()) return;

  const files = filesState.get();
  const fileName = uniqueFileName(files, name.trim());
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  openNewFile(files, fileName, getTemplateForExt(ext));
}

export function addFileInFolder(folderPath: string): void {
  const name = prompt(`Enter filename in "${folderPath}/":`, "untitled.html");
  if (!name || !name.trim()) return;

  const files = filesState.get();
  const desired = folderPath ? folderPath + "/" + name.trim() : name.trim();
  const fileName = uniqueFileName(files, desired);
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  openNewFile(files, fileName, getTemplateForExt(ext));
}

export function addFolderAction(): void {
  const name = prompt("Enter folder name:", "new-folder");
  if (!name || !name.trim()) return;

  const folderName = name.trim().replace(/\s+/g, "-").toLowerCase();
  createFolder(folderName);
}

export function addSubfolderAction(parentPath: string): void {
  const name = prompt(`Enter folder name in "${parentPath}/":`, "new-folder");
  if (!name || !name.trim()) return;

  const folderName =
    parentPath + "/" + name.trim().replace(/\s+/g, "-").toLowerCase();
  createFolder(folderName);
}

function createFolder(folderName: string): void {
  const fileName = folderName + "/.gitkeep";
  const files = filesState.get();
  if (files.some((f) => f.name === fileName)) return;

  filesState.set([...files, createFile(fileName, "")]);
  expandedFolders.add(folderName);
  syncFileToWorker(fileName, "");
}

function deleteFiles(paths: string[]): void {
  for (const path of paths) {
    deleteFileFromWorker(path);
  }
  // Drop folder expansion state for folders that no longer contain files.
  const remaining = filesState.get();
  for (const folder of Array.from(expandedFolders)) {
    if (!remaining.some((f) => f.name.startsWith(folder + "/"))) {
      expandedFolders.delete(folder);
    }
  }
}

export function closeFileAction(id: string): void {
  const files = filesState.get();
  if (files.length <= 1) return;

  const idx = files.findIndex((f) => f.id === id);
  if (idx === -1) return;
  const updated = files.filter((f) => f.id !== id);
  filesState.set(updated);

  const wasActive = activeFileState.get() === id;
  if (wasActive && updated.length > 0) {
    const nextIdx = Math.min(idx, updated.length - 1);
    const file = updated[nextIdx];
    if (file) switchToFile(file);
  }

  deleteFiles([id]);
}

export function renameFileAction(id: string): void {
  const files = filesState.get();
  const file = files.find((f) => f.id === id);
  if (!file) return;
  const newName = prompt("Rename file:", file.name);
  if (!newName || !newName.trim() || newName.trim() === file.name) return;
  const trimmed = newName.trim();
  if (files.some((f) => f.id === trimmed)) {
    showError(`A file named "${trimmed}" already exists.`);
    return;
  }
  const ext = trimmed.split(".").pop()?.toLowerCase() || "";
  const language = getLanguageForExt(ext);
  const updated = files.map((f) =>
    f.id === id ? { ...f, id: trimmed, name: trimmed, language } : f,
  );
  const wasActive = activeFileState.get() === id;
  filesState.set(updated);
  if (wasActive) {
    const renamed = updated.find((f) => f.id === trimmed);
    if (renamed) switchToFile(renamed);
  }
  deleteFileFromWorker(id);
  syncFileToWorker(trimmed, file.content);
}

export function duplicateFileAction(id: string): void {
  const files = filesState.get();
  const file = files.find((f) => f.id === id);
  if (!file) return;
  const [stem, ext] = splitFileName(file.name);
  const newName = uniqueFileName(files, `${stem}-copy${ext}`);
  const newFile: FileTab = {
    id: newName,
    name: newName,
    content: file.content,
    language: file.language,
  };
  filesState.set([...files, newFile]);
  const tab = filesState.get().find((f) => f.id === newName);
  if (tab) switchToFile(tab);
  syncFileToWorker(newName, file.content);
}

export function closeOthersAction(id: string): void {
  const files = filesState.get();
  const kept = files.filter((f) => f.id === id);
  if (kept.length === 0) return;
  const removed = files.filter((f) => f.id !== id);
  filesState.set(kept);
  switchToFile(kept[0]);
  deleteFiles(removed.map((f) => f.id));
}

export function closeAllAction(): void {
  const files = filesState.get();
  if (files.length === 0) return;
  const [kept, ...removed] = files;
  filesState.set([kept]);
  switchToFile(kept);
  deleteFiles(removed.map((f) => f.id));
}

export function deleteFolderAction(folderPath: string): void {
  if (!confirm(`Delete folder "${folderPath}" and all files inside?`)) return;
  const files = filesState.get();
  const removed = files.filter((f) => {
    const dir = getDirPath(f.name);
    return dir === folderPath || dir.startsWith(folderPath + "/");
  });
  if (removed.length === 0) return;
  const removedIds = new Set(removed.map((f) => f.id));
  const updated = files.filter((f) => !removedIds.has(f.id));
  filesState.set(updated);

  const activeId = activeFileState.get();
  if (!updated.find((f) => f.id === activeId)) {
    if (updated.length > 0) {
      switchToFile(updated[0]);
    } else {
      // Never leave the editor with zero files.
      const fallback = createFile("untitled.html", getTemplateForExt("html"));
      filesState.set([fallback]);
      switchToFile(fallback);
    }
  }

  expandedFolders.delete(folderPath);
  deleteFiles(removed.map((f) => f.id));
}

export function importFilesAction(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept =
    ".html,.htm,.css,.js,.mjs,.cjs,.ts,.tsx,.jsx,.json,.svg,.xml,.txt,.md";
  input.addEventListener("change", async () => {
    const fileList = input.files;
    if (!fileList || fileList.length === 0) return;
    const newTabs: FileTab[] = [];
    let currentFiles = filesState.get();
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const content = await f.text();
      const fileName = uniqueFileName(currentFiles, f.name);
      const tab = createFile(fileName, content);
      newTabs.push(tab);
      currentFiles = [...currentFiles, tab];
    }
    if (newTabs.length > 0) {
      filesState.set(currentFiles);
      const file = currentFiles.find((f) => f.id === newTabs[0].id);
      if (file) switchToFile(file);
      for (const tab of newTabs) {
        syncFileToWorker(tab.name, tab.content);
      }
    }
  });
  input.click();
}

export async function exportAsZip(): Promise<void> {
  const files = filesState.get();
  const nonEmpty = files.filter((f) => f.content.trim());

  if (nonEmpty.length === 0) {
    showError("Nothing to export!");
    return;
  }

  if (nonEmpty.length === 1) {
    try {
      const blob = new Blob([nonEmpty[0].content], { type: "text/plain" });
      saveAs(blob, nonEmpty[0].name);
    } catch (err) {
      console.error("Failed to export file:", err);
      showError("Unable to export file.");
    }
    return;
  }

  try {
    const zip = new JSZip();
    for (const file of nonEmpty) {
      zip.file(file.name, file.content);
    }
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "htmlrunner-export.zip");
  } catch (err) {
    console.error("Failed to create ZIP:", err);
    showError("Unable to create ZIP.");
  }
}

interface ContextMenuItem {
  label: string;
  icon: string;
  action: () => void;
}

function showContextMenu(e: MouseEvent, items: ContextMenuItem[]): void {
  e.preventDefault();
  document.querySelector(".tab-context-menu")?.remove();

  const menu = document.createElement("div");
  menu.className = "tab-context-menu";
  menu.style.left = e.clientX + "px";
  menu.style.top = e.clientY + "px";

  for (const item of items) {
    const el = document.createElement("div");
    el.className = "context-menu-item";
    el.innerHTML = `<i class="fas ${item.icon}"></i> ${item.label}`;
    el.addEventListener("click", () => {
      menu.remove();
      item.action();
    });
    menu.appendChild(el);
  }

  const closeMenu = (ev: MouseEvent) => {
    if (!menu.contains(ev.target as Node)) {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    }
  };
  setTimeout(() => document.addEventListener("click", closeMenu), 0);

  document.body.appendChild(menu);
}

export function showFolderContextMenu(e: MouseEvent, folderPath: string): void {
  showContextMenu(e, [
    { label: "New File", icon: "fa-file", action: () => addFileInFolder(folderPath) },
    { label: "New Folder", icon: "fa-folder", action: () => addSubfolderAction(folderPath) },
    { label: "Delete Folder", icon: "fa-trash", action: () => deleteFolderAction(folderPath) },
  ]);
}

export function showTabContextMenu(e: MouseEvent, fileId: string): void {
  showContextMenu(e, [
    { label: "Close", icon: "fa-times", action: () => closeFileAction(fileId) },
    { label: "Close Others", icon: "fa-times-circle", action: () => closeOthersAction(fileId) },
    { label: "Close All", icon: "fa-trash", action: () => closeAllAction() },
    { label: "Rename", icon: "fa-pencil", action: () => renameFileAction(fileId) },
    { label: "Duplicate", icon: "fa-copy", action: () => duplicateFileAction(fileId) },
  ]);
}
