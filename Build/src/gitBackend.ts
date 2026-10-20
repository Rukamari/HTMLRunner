import type { OpfsGit } from "wasm-git/lg2_opfs_auto.js";
import type { GitBackend, GitFileSystem, GitModule } from "./gitWorkerTypes";

export interface GitBackendRequest {
  user: string;
  email: string;
  print?: (text: string) => void;
  printErr?: (text: string) => void;
}

export interface GitBackendLoad {
  backend: GitBackend;
  variant: string;
  fallbackReason: string | null;
}

export const IDBFS_REPO_ROOT = "/repos";

interface IdbfsFs extends GitFileSystem {
  chdir(path: string): void;
  mkdir(path: string): void;
  mount(type: unknown, opts: object, mountpoint: string): void;
  filesystems: Record<string, unknown>;
  syncfs(populate: boolean, callback: (err?: Error | null) => void): void;
  writeFile(path: string, data: string): void;
  readFile(path: string, opts?: { encoding?: string }): string | Uint8Array;
}

interface IdbfsModule extends GitModule {
  FS: IdbfsFs;
  callMain(args: string[]): void | Promise<void>;
}

function ensureDirectory(FS: IdbfsFs, dir: string): void {
  let current = "";
  for (const part of dir.split("/")) {
    if (!part) continue;
    current += `/${part}`;
    try {
      FS.mkdir(current);
    } catch {
    }
  }
}

function syncfs(FS: IdbfsFs, populate: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    FS.syncfs(populate, (err) => (err ? reject(err) : resolve()));
  });
}

function ensureGitSkeleton(FS: IdbfsFs, dir: string): void {
  try {
    FS.readdir(`${dir}/.git/objects`);
  } catch {
    return;
  }
  for (const sub of [
    "objects/pack",
    "objects/info",
    "refs",
    "refs/heads",
    "refs/tags",
  ]) {
    try {
      FS.mkdir(`${dir}/.git/${sub}`);
    } catch {
    }
  }
}

async function loadIdbfsGit({
  user,
  email,
  print,
  printErr,
}: GitBackendRequest): Promise<GitBackend> {
  const { default: createGitModule } = await import("wasm-git/lg2.js");
  const module = (await createGitModule({
    print: print ?? (() => {}),
    printErr: printErr ?? (() => {}),
  })) as unknown as IdbfsModule;
  const FS = module.FS;

  ensureDirectory(FS, "/home/web_user");
  FS.writeFile(
    "/home/web_user/.gitconfig",
    `[user]\n  name = ${user}\n  email = ${email}`,
  );

  ensureDirectory(FS, IDBFS_REPO_ROOT);
  try {
    FS.mount(FS.filesystems["IDBFS"], {}, IDBFS_REPO_ROOT);
  } catch {
  }

  await syncfs(FS, true);
  try {
    FS.chdir(IDBFS_REPO_ROOT);
  } catch {
  }

  const repoDir = (repoName: string): string => `${IDBFS_REPO_ROOT}/${repoName}`;

  const persist = (): Promise<void> => syncfs(FS, false);

  return {
    variant: "idbfs",
    FS,
    module,
    repoDir,
    async syncRepo(repoName) {
      await syncfs(FS, true);
      const dir = repoDir(repoName);
      try {
        if (FS.readdir(dir).includes(".git")) {
          ensureGitSkeleton(FS, dir);
          FS.chdir(dir);
          return true;
        }
      } catch {
      }
      return false;
    },
    async run(args) {
      await module.callMain(args);
      await persist();
    },
    async writeFile(repoName, filename, contents) {
      const path = `${repoDir(repoName)}/${filename}`;
      ensureDirectory(FS, path.slice(0, path.lastIndexOf("/")));
      FS.writeFile(path, contents);
      await persist();
    },
    readFile(repoName, filename, encoding = "utf8") {
      return FS.readFile(`${repoDir(repoName)}/${filename}`, { encoding });
    },
    async deleteFile(repoName, filename) {
      try {
        FS.unlink(`${repoDir(repoName)}/${filename}`);
      } catch {
      }
      await persist();
    },
  };
}

function wrapOpfsGit(git: OpfsGit): GitBackend {
  return {
    variant: git.variant,
    FS: git.FS,
    module: git.module,
    repoDir: (repoName) => git.repoDir(repoName),
    syncRepo: (repoName) => git.syncRepo(repoName),
    run: (args) => git.run(args),
    writeFile: (repoName, filename, contents) =>
      git.writeFile(repoName, filename, contents),
    readFile: (repoName, filename, encoding) =>
      git.readFile(repoName, filename, encoding),
    async deleteFile(repoName, filename) {
      try {
        git.FS.unlink(`${git.repoDir(repoName)}/${filename}`);
      } catch {
      }
    },
  };
}

export async function loadGitBackend(
  request: GitBackendRequest,
): Promise<GitBackendLoad> {
  const { loadOpfsGit, selectOpfsVariant } = await import(
    "wasm-git/lg2_opfs_auto.js"
  );

  const variant = selectOpfsVariant();
  if (variant) {
    try {
      const backend = wrapOpfsGit(
        await loadOpfsGit({
          user: request.user,
          email: request.email,
          moduleOverrides: {
            print: request.print ?? (() => {}),
            printErr: request.printErr ?? (() => {}),
          },
        }),
      );
      return { backend, variant: backend.variant, fallbackReason: null };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const backend = await loadIdbfsGit(request);
      return {
        backend,
        variant: backend.variant,
        fallbackReason: `OPFS (${variant}) failed: ${reason}`,
      };
    }
  }

  const backend = await loadIdbfsGit(request);
  return {
    backend,
    variant: backend.variant,
    fallbackReason: "OPFS unavailable (insecure context?)",
  };
}
