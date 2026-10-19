export interface GitFile {
  path: string;
  content: string;
}

export interface GitInitResult {
  variant: string;
  files: GitFile[];
}

export interface GitCommandResult {
  stdout: string;
  files?: GitFile[];
}

/** The Comlink contract shared by the worker and the main thread. */
export interface GitWorkerAPI {
  init(user?: string, email?: string): Promise<GitInitResult>;
  writeFile(filePath: string, content: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  gitCommand(command: string, args: string[]): Promise<GitCommandResult>;
  readFiles(): Promise<GitFile[]>;
  sync(): Promise<void>;
}
