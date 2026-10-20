import { wrap, type Remote } from "comlink";
import { filesState, activeFileState } from "./appState";
import { getVFS } from "./container";
import { getLanguageForExt } from "./defaultContent";
import type { FileTab } from "./types";
import type { GitFile, GitWorkerAPI } from "./gitWorkerTypes";

let api: Remote<GitWorkerAPI> | null = null;
let _ready = false;
let _readyResolve: () => void;
const _readyPromise = new Promise<void>((r) => { _readyResolve = r; });

let _variant: string | null = null;
let _fallbackReason: string | null = null;

export function gitVariant(): string | null {
  return _variant;
}

export function gitFallbackReason(): string | null {
  return _fallbackReason;
}

export function gitReady(): Promise<void> {
  return _readyPromise;
}

export function isGitReady(): boolean {
  return _ready;
}

export function initGitService(worker: Worker): void {
  api = wrap<GitWorkerAPI>(worker);

  api.init("HTMLRunner", "runner@htmlrunner.app")
    .then(({ variant, files, fallbackReason }) => {
      _variant = variant;
      _fallbackReason = fallbackReason ?? null;
      if (fallbackReason) {
        console.warn(`Git ready (${variant}) — ${fallbackReason}`);
      } else {
        console.log(`Git ready (${variant})`);
      }
      _ready = true;
      _readyResolve();
      if (files && files.length > 0) {
        loadFilesFromWorker(files);
      }
    })
    .catch((err) => {
      console.error("Git init failed:", err);
    });
}

function loadFilesFromWorker(files: GitFile[]): void {
  const vfs = getVFS();
  const tabs: FileTab[] = [];

  for (const file of files) {
    const ext = file.path.split(".").pop()?.toLowerCase() || "";
    const skipExts = [
      "png","jpg","jpeg","gif","ico","woff","woff2","ttf","eot","zip","gz","wasm",
    ];
    if (skipExts.includes(ext)) continue;

    tabs.push({
      id: file.path,
      name: file.path,
      content: file.content,
      language: getLanguageForExt(ext),
    });

    const dir = file.path.substring(0, file.path.lastIndexOf("/"));
    if (dir) {
      try {
        vfs.mkdirSync(`/sandbox/${dir}`, { recursive: true });
      } catch {
      }
    }
    try {
      vfs.writeFileSync(`/sandbox/${file.path}`, file.content);
    } catch {
    }
  }

  tabs.sort((a, b) => a.name.localeCompare(b.name));

  if (tabs.length > 0) {
    filesState.set(tabs);
    const currentActive = activeFileState.get();
    const firstTab = tabs[0];
    if (firstTab && !tabs.find((f) => f.id === currentActive)) {
      activeFileState.set(firstTab.id);
    }
  }
}

async function gitExec(command: string, ...args: string[]): Promise<string> {
  if (!api) throw new Error("Git not initialized");
  const result = await api.gitCommand(command, args);
  if (result.files) loadFilesFromWorker(result.files);
  return result.stdout || "";
}

export async function gitInit(): Promise<void> {
  await gitExec("init", "/sandbox");
}

export async function gitClone(url: string): Promise<string> {
  return await gitExec("clone", url, "/sandbox");
}

export async function gitAddAll(): Promise<void> {
  await gitExec("add", ".");
}

export async function gitCommit(message: string): Promise<string> {
  await gitAddAll();
  return await gitExec("commit", "-m", message);
}

export async function gitStatus(): Promise<string> {
  return await gitExec("status");
}

export async function gitStatusPorcelain(): Promise<string> {
  return await gitExec("status", "--porcelain");
}

export async function gitLog(): Promise<string> {
  return await gitExec("log", "--oneline", "-20");
}

export async function gitDiff(): Promise<string> {
  return await gitExec("diff");
}

export async function gitPush(
  remote = "origin",
  ref = "main",
): Promise<string> {
  await gitAddAll();
  return await gitExec("push", remote, ref);
}

export async function gitPull(
  remote = "origin",
  ref = "main",
): Promise<string> {
  return await gitExec("fetch", remote) + "\n" + await gitExec("merge", `${remote}/${ref}`);
}

export async function gitBranches(): Promise<string> {
  return await gitExec("branch", "-a");
}

export async function gitCheckout(branch: string): Promise<string> {
  return await gitExec("checkout", branch);
}

export async function syncFileToWorker(
  filePath: string,
  content: string,
): Promise<void> {
  if (!api) return;
  api.writeFile(filePath, content).catch(() => {});
}

export function deleteFileFromWorker(filePath: string): void {
  if (api) api.deleteFile(filePath).catch(() => {});
  try { getVFS().unlinkSync(`/sandbox/${filePath}`); } catch {  }
}

export async function syncAllFilesToWorker(): Promise<void> {
  const currentApi = api;
  if (!currentApi) return;
  const files = filesState.get();
  await Promise.all(
    files.map((file) =>
      currentApi.writeFile(file.name, file.content).catch(() => {}),
    ),
  );
}

export async function requestFilesFromWorker(): Promise<void> {
  if (!api) return;
  const files = await api.readFiles();
  loadFilesFromWorker(files);
}
