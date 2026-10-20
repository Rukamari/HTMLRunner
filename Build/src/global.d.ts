declare module "*.css";
declare module "@fortawesome/fontawesome-free/css/all.min.css" {
  const css: string;
  export default css;
}
declare module "wasm-git/lg2_opfs_auto.js" {
  export function loadOpfsGit(options?: {
    env?: typeof globalThis;
    variant?: "pthreads" | "jspi" | "asyncify";
    baseUrl?: string | URL;
    user?: string;
    email?: string;
    moduleArg?: object;
    moduleOverrides?: {
      print?: (text: string) => void;
      printErr?: (text: string) => void;
    };
  }): Promise<OpfsGit>;

  export interface OpfsFileSystem {
    readdir(path: string): string[];
    unlink(path: string): void;
    [key: string]: unknown;
  }

  export interface OpfsModule {
    print: (text: string) => void;
    printErr: (text: string) => void;
    [key: string]: unknown;
  }

  export class OpfsGit {
    variant: string;
    FS: OpfsFileSystem;
    module: OpfsModule;
    repoDir(repoName: string): string;
    init(opts?: { user?: string; email?: string }): Promise<this>;
    syncRepo(repoName: string): Promise<boolean>;
    run(args: string[]): Promise<void>;
    clone(url: string, repoName: string): Promise<string[]>;
    writeFile(repoName: string, filename: string, contents: string): Promise<void>;
    readFile(repoName: string, filename: string, encoding?: string): string | Uint8Array;
    readdir(repoName: string): string[];
    addCommitPush(repoName: string, filename: string, message?: string): Promise<string[]>;
    removeRepo(repoName: string): Promise<void>;
  }

  export function selectOpfsVariant(env?: typeof globalThis): "pthreads" | "jspi" | "asyncify" | null;
  export function detectOpfsEnvironment(env?: typeof globalThis): {
    opfsAvailable: boolean;
    crossOriginIsolated: boolean;
    jspiAvailable: boolean;
  };
  export const VARIANT_FILES: Record<string, string>;
  export default loadOpfsGit;
}

declare module "wasm-git/lg2.js" {
  export interface IdbfsFileSystem {
    readdir(path: string): string[];
    unlink(path: string): void;
    mkdir(path: string): void;
    chdir(path: string): void;
    readFile(path: string, opts?: { encoding?: string }): string | Uint8Array;
    writeFile(path: string, data: string): void;
    mount(type: unknown, opts: object, mountpoint: string): void;
    filesystems: Record<string, unknown>;
    syncfs(populate: boolean, callback: (err?: Error | null) => void): void;
    [key: string]: unknown;
  }

  export interface IdbfsModule {
    FS: IdbfsFileSystem;
    print: (text: string) => void;
    printErr: (text: string) => void;
    callMain(args: string[]): void | Promise<void>;
    [key: string]: unknown;
  }

  export default function createGitModule(
    moduleArg?: object,
  ): Promise<IdbfsModule>;
}

declare module "*?worker&inline" {
  const WorkerConstructor: {
    new (options?: { name?: string }): Worker;
  };
  export default WorkerConstructor;
}
