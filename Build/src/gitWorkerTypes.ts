export interface GitFile {
  path: string;
  content: string;
}

export interface GitFileSystem {
  readdir(path: string): string[];
  unlink(path: string): void;
  [key: string]: unknown;
}

export interface GitModule {
  print: (text: string) => void;
  printErr: (text: string) => void;
  [key: string]: unknown;
}

export interface GitBackend {
  variant: string;
  FS: GitFileSystem;
  module: GitModule;
  repoDir(repoName: string): string;
  syncRepo(repoName: string): Promise<boolean>;
  run(args: string[]): Promise<void>;
  writeFile(repoName: string, filename: string, contents: string): Promise<void>;
  readFile(
    repoName: string,
    filename: string,
    encoding?: string,
  ): string | Uint8Array;
  deleteFile(repoName: string, filename: string): Promise<void>;
}

export interface GitInitResult {
  variant: string;
  files: GitFile[];
  fallbackReason?: string | null;
}

export interface GitCommandResult {
  stdout: string;
  files?: GitFile[];
}

export interface GitWorkerAPI {
  init(user?: string, email?: string): Promise<GitInitResult>;
  writeFile(filePath: string, content: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  gitCommand(command: string, args: string[]): Promise<GitCommandResult>;
  readFiles(): Promise<GitFile[]>;
  sync(): Promise<void>;
}
