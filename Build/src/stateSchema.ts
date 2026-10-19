import type { FileTab, LogLevel, State } from "./types";
import {
  isEditorLanguage,
  isLogLevel,
  isOutputType,
  isRecord,
} from "./types";
import { getLanguageForExt } from "./defaultContent";

function parseFileTab(value: unknown): FileTab | null {
  if (!isRecord(value)) return null;
  const { id, name, content, language } = value;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof content !== "string"
  ) {
    return null;
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return {
    id,
    name,
    content,
    language: isEditorLanguage(language)
      ? language
      : getLanguageForExt(ext),
  };
}

function isNumberPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

/** Validate untrusted localStorage JSON before it reaches typed state. */
export function parseStateSnapshot(raw: unknown): Partial<State> {
  if (!isRecord(raw)) return {};

  const {
    files: rawFiles,
    activeFile,
    activeOutput,
    splitSizes,
    darkMode,
    autoRun,
    logFilters: rawFilters,
  } = raw;
  const snapshot: Partial<State> = {};

  if (Array.isArray(rawFiles)) {
    const files = rawFiles
      .map(parseFileTab)
      .filter((file): file is FileTab => file !== null);
    if (files.length > 0) snapshot.files = files;
  }

  if (typeof activeFile === "string") {
    snapshot.activeFile = activeFile;
  }

  if (isOutputType(activeOutput)) {
    snapshot.activeOutput = activeOutput;
  }

  if (isNumberPair(splitSizes)) {
    snapshot.splitSizes = [splitSizes[0], splitSizes[1]];
  }

  if (typeof darkMode === "boolean") {
    snapshot.darkMode = darkMode;
  }

  if (typeof autoRun === "boolean") {
    snapshot.autoRun = autoRun;
  }

  if (Array.isArray(rawFilters)) {
    const filters: LogLevel[] = rawFilters.filter(isLogLevel);
    // An empty list is meaningful (all levels hidden); only drop malformed lists.
    if (filters.length > 0 || rawFilters.length === 0) {
      snapshot.logFilters = filters;
    }
  }

  return snapshot;
}
