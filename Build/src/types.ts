export const OUTPUT_TYPES = ["preview", "console", "terminal"] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

export const LOG_LEVELS = ["log", "error", "warn", "info"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const EDITOR_LANGUAGES = [
  "html",
  "css",
  "javascript",
  "markdown",
  "text",
] as const;
export type EditorLanguage = (typeof EDITOR_LANGUAGES)[number];

export interface FileTab {
  id: string;
  name: string;
  content: string;
  language: EditorLanguage;
}

export interface State {
  files: FileTab[];
  activeFile: string;
  activeOutput: OutputType;
  splitSizes: number[];
  darkMode: boolean;
  autoRun: boolean;
  logFilters?: LogLevel[];
}

export interface ConsoleMessage {
  type: "console";
  level: LogLevel;
  data: ConsoleData[];
  timestamp: string;
}

export interface NavigationMessage {
  type: "navigate";
  href: string;
}

export type PreviewMessage = ConsoleMessage | NavigationMessage;

/**
 * Values that cross the preview postMessage boundary. Structured clone can
 * carry arbitrary values, so keep this honest (unknown) and narrow while
 * rendering instead of pretending every value is a printable object.
 */
export type ConsoleData = unknown;

export interface StackInfo {
  stack?: string;
}

export interface Actions {
  runCode: () => Promise<void>;
  clearConsole: () => void;
  resetCode: (skipConfirmation?: boolean) => void;
  formatCode: () => Promise<void>;
  toggleAutoRun: () => void;
  toggleDarkMode: () => void;
  switchFile: (id: string) => void;
  addFile: () => void;
  addFolder: () => void;
  closeFile: (id: string) => void;
  importFiles: () => void;
  renameFile: (id: string) => void;
  duplicateFile: (id: string) => void;
  closeOthers: (id: string) => void;
  closeAll: () => void;
  switchOutput: (output: OutputType) => void;
  exportAsZip: () => Promise<void>;
  copyAllConsole: () => void;
  copyEditorContent: () => void;
  toggleSearch: (mode?: "find" | "replace") => void;
  undo?: () => void;
  redo?: () => void;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function includes<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function isOutputType(value: unknown): value is OutputType {
  return includes(OUTPUT_TYPES, value);
}

export function isLogLevel(value: unknown): value is LogLevel {
  return includes(LOG_LEVELS, value);
}

export function isEditorLanguage(value: unknown): value is EditorLanguage {
  return includes(EDITOR_LANGUAGES, value);
}

export function isConsoleMessage(value: unknown): value is ConsoleMessage {
  if (!isRecord(value)) return false;
  const { type, level, data, timestamp } = value;
  return (
    type === "console" &&
    isLogLevel(level) &&
    Array.isArray(data) &&
    typeof timestamp === "string"
  );
}

export function isNavigationMessage(
  value: unknown,
): value is NavigationMessage {
  if (!isRecord(value)) return false;
  const { type, href } = value;
  return type === "navigate" && typeof href === "string";
}
