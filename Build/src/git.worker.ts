import { expose } from "comlink";
import type { OpfsGit } from "wasm-git/lg2_opfs_auto.js";
import type { GitFile, GitWorkerAPI } from "./gitWorkerTypes";

let git: OpfsGit | null = null;
const REPO_NAME = "sandbox";
let _mutex: Promise<unknown> = Promise.resolve();

function queue<T>(fn: () => Promise<T>): Promise<T> {
  const next = _mutex.then(fn, fn);
  _mutex = next.catch(() => {});
  return next;
}

async function withRetry<T>(fn: () => T | Promise<T>, maxRetries = 2): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isStale =
        msg.includes("cached in an interface object") ||
        msg.includes("stale") ||
        msg.includes("state has changed");
      if (isStale && i < maxRetries && git) {
        try { await git.syncRepo(REPO_NAME); } catch {  }
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

async function runGitCommand(command: string, gitArgs: string[]): Promise<string> {
  if (!git) throw new Error("Git not initialized");
  await git.syncRepo(REPO_NAME);

  const stdout: string[] = [];
  const origPrint = git.module.print;
  const origPrintErr = git.module.printErr;
  git.module.print = (text: string) => stdout.push(text);
  git.module.printErr = () => {  };

  try {
    await git.run([command, ...gitArgs]);
  } finally {
    git.module.print = origPrint;
    git.module.printErr = origPrintErr;
  }

  return stdout.join("\n");
}

const SKIP_NAMES = new Set([".", "..", ".git", "node_modules"]);
const SKIP_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "ico", "svg", "webp",
  "woff", "woff2", "ttf", "eot", "otf",
  "zip", "gz", "wasm", "mp3", "mp4", "pdf",
]);

function isDirectory(path: string): boolean {
  if (!git) return false;
  try {
    const entries = git.FS.readdir(path);
    return Array.isArray(entries);
  } catch {
    return false;
  }
}

function readAllFiles(): GitFile[] {
  if (!git) return [];
  const root = git.repoDir(REPO_NAME);
  const results: GitFile[] = [];

  const walk = (dir: string, prefix: string): void => {
    let entries: string[];
    try {
      entries = git!.FS.readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (SKIP_NAMES.has(name)) continue;
      const full = `${dir}/${name}`;
      const rel = prefix ? `${prefix}/${name}` : name;
      if (isDirectory(full)) {
        walk(full, rel);
        continue;
      }
      const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "";
      if (SKIP_EXTS.has(ext)) continue;
      try {
        const content = git!.readFile(REPO_NAME, rel);
        if (typeof content === "string") {
          results.push({ path: rel, content });
        } else {
          results.push({ path: rel, content: new TextDecoder().decode(content) });
        }
      } catch {
      }
    }
  };

  walk(root, "");
  return results;
}

const api: GitWorkerAPI = {
  async init(user = "HTMLRunner", email = "runner@htmlrunner.app") {
    return queue(async () => {
      const { loadOpfsGit } = await import("wasm-git/lg2_opfs_auto.js");
      git = await loadOpfsGit({ user, email });

      const found = await git.syncRepo(REPO_NAME);
      let files: GitFile[] = [];

      if (found) {
        files = readAllFiles();
      } else {
        await git.run(["init", git.repoDir(REPO_NAME)]);
        await git.syncRepo(REPO_NAME);
      }

      return { variant: git.variant || "unknown", files };
    });
  },

  async writeFile(filePath: string, content: string) {
    return queue(() =>
      withRetry(() => git!.writeFile(REPO_NAME, filePath, content)),
    );
  },

  async deleteFile(filePath: string) {
    return queue(async () => {
      if (!git) throw new Error("Git not initialized");
      await git.syncRepo(REPO_NAME);
      const path = `${git.repoDir(REPO_NAME)}/${filePath}`;
      await withRetry(() => {
        try {
          git!.FS.unlink(path);
        } catch {
        }
      });
    });
  },

  async gitCommand(command: string, args: string[]) {
    return queue(async () => {
      const stdout = await withRetry(() => runGitCommand(command, args));
      const refreshCmds = ["clone", "pull", "fetch", "checkout", "reset", "merge"];
      if (refreshCmds.includes(command)) {
        const files = await withRetry(() => readAllFiles());
        return { stdout, files };
      }
      return { stdout };
    });
  },

  async readFiles() {
    return queue(() => withRetry(() => readAllFiles()));
  },

  async sync() {
    return queue(async () => { await git?.syncRepo(REPO_NAME); });
  },
};

expose(api);
