import { getVFS } from "./container";
import { deleteFileFromWorker, syncFileToWorker } from "./git-service";

let _syncTimer: ReturnType<typeof setTimeout> | null = null;

export function initBridge(): void {
  const vfs = getVFS();

  vfs.on("change", (path: string, content: string) => {
    if (!path.startsWith("/sandbox/")) return;
    const relPath = path.slice("/sandbox/".length);
    if (!relPath || relPath.includes("node_modules") || relPath.startsWith(".")) return;
    syncFileToWorker(relPath, content);
  });

  vfs.on("delete", (path: string) => {
    if (!path.startsWith("/sandbox/")) return;
    const relPath = path.slice("/sandbox/".length);
    if (!relPath || relPath.includes("node_modules") || relPath.startsWith(".")) return;
    deleteFileFromWorker(relPath);
  });
}

/** Write a file into the sandbox VFS (creating parent folders as needed). */
export function syncFileToVFS(name: string, content: string): void {
  const vfs = getVFS();
  const dir = name.substring(0, name.lastIndexOf("/"));
  if (dir) {
    try {
      vfs.mkdirSync(`/sandbox/${dir}`, { recursive: true });
    } catch {
      // directory already exists
    }
  }
  try {
    vfs.writeFileSync(`/sandbox/${name}`, content);
  } catch {
    // skip unwritable file
  }
}

export function syncFilesToWorker(files: { name: string; content: string }[]): void {
  for (const file of files) {
    syncFileToVFS(file.name, file.content);
    syncFileToWorker(file.name, file.content);
  }
}

export function syncFilesDebounced(
  files: { name: string; content: string }[],
): void {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    syncFilesToWorker(files);
  }, 500);
}

export function syncAllFilesToVFS(
  files: { name: string; content: string }[],
): void {
  for (const file of files) {
    syncFileToVFS(file.name, file.content);
  }
}
