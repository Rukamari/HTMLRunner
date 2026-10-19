import { effect, path, signal } from "@nisoku/sairin";
import type { State, Actions, FileTab, LogLevel, OutputType } from "./types";
import { LOG_LEVELS } from "./types";
import { getDefaultFiles } from "./defaultContent";
import { parseStateSnapshot } from "./stateSchema";
import { showError } from "./ui";

const STORAGE_KEY = "htmlRunnerState";

function readPersistedState(): Partial<State> {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    return savedState ? parseStateSnapshot(JSON.parse(savedState)) : {};
  } catch {
    return {};
  }
}

const persistedState = readPersistedState();
const defaultFiles = getDefaultFiles();

const filesInitial =
  persistedState.files && persistedState.files.length > 0
    ? persistedState.files
    : defaultFiles;

const activeFileInitial: string =
  typeof persistedState.activeFile === "string" &&
  filesInitial.some((f) => f.id === persistedState.activeFile)
    ? persistedState.activeFile
    : filesInitial[0]?.id ?? "index.html";

const darkModeInitial =
  persistedState.darkMode ?? localStorage.getItem("darkMode") === "true";
const autoRunInitial =
  persistedState.autoRun ?? localStorage.getItem("autoRun") === "true";
const activeOutputInitial: OutputType = persistedState.activeOutput ?? "preview";
const splitSizesInitial: number[] = persistedState.splitSizes ?? [50, 50];
const logFiltersInitial: LogLevel[] = persistedState.logFilters ?? [...LOG_LEVELS];

let _lastPersistedSnapshot = "";
let _idleHandle: number | null = null;
let _timeoutHandle: number | null = null;

export const filesState = signal<FileTab[]>(
  path("htmlrunner", "editor", "files"),
  filesInitial,
);
export const activeFileState = signal(
  path("htmlrunner", "editor", "activeFile"),
  activeFileInitial,
);
export const activeOutputState = signal<OutputType>(
  path("htmlrunner", "ui", "activeOutput"),
  activeOutputInitial,
);
export const splitSizesState = signal(
  path("htmlrunner", "layout", "splitSizes"),
  splitSizesInitial,
);
export const darkModeState = signal(
  path("htmlrunner", "ui", "darkMode"),
  darkModeInitial,
);
export const autoRunState = signal(
  path("htmlrunner", "editor", "autoRun"),
  autoRunInitial,
);
export const logFilters = signal<LogLevel[]>(
  path("htmlrunner", "console", "filters"),
  logFiltersInitial,
);
export const stateHydrated = signal(
  path("htmlrunner", "meta", "stateHydrated"),
  false,
);

export const loadingVisible = signal(
  path("htmlrunner", "ui", "loadingVisible"),
  false,
);
export const errorMessage = signal(path("htmlrunner", "ui", "errorMessage"), "");
export const errorVisible = signal(path("htmlrunner", "ui", "errorVisible"), false);
export type ToastKind = "error" | "success" | "info";
export const toastKind = signal<ToastKind>(path("htmlrunner", "ui", "toastKind"), "error");
effect(() => errorVisible.set(errorMessage.get().length > 0));

export const themeLabel = signal(path("htmlrunner", "ui", "themeLabel"), darkModeState.get() ? "Light Mode" : "Dark Mode");
export const themeIconClass = signal(path("htmlrunner", "ui", "themeIconClass"), darkModeState.get() ? "fas fa-sun" : "fas fa-moon");
effect(() => {
  themeLabel.set(darkModeState.get() ? "Light Mode" : "Dark Mode");
  themeIconClass.set(darkModeState.get() ? "fas fa-sun" : "fas fa-moon");
});

export const autoRunText = signal(path("htmlrunner", "ui", "autoRunText"), autoRunState.get() ? "On" : "Off");
effect(() => autoRunText.set(autoRunState.get() ? "On" : "Off"));

export const previewClass = signal(path("htmlrunner", "ui", "previewClass"), activeOutputState.get() === "preview" ? "tab active" : "tab");
export const consoleClass = signal(path("htmlrunner", "ui", "consoleClass"), activeOutputState.get() === "console" ? "tab active" : "tab");
export const terminalClass = signal(path("htmlrunner", "ui", "terminalClass"), activeOutputState.get() === "terminal" ? "tab active" : "tab");
effect(() => {
  previewClass.set(activeOutputState.get() === "preview" ? "tab active" : "tab");
  consoleClass.set(activeOutputState.get() === "console" ? "tab active" : "tab");
  terminalClass.set(activeOutputState.get() === "terminal" ? "tab active" : "tab");
});

export const bodyClass = signal(path("htmlrunner", "ui", "bodyClass"), darkModeState.get() ? "dark-mode" : "");
export const isResizing = signal(path("htmlrunner", "ui", "isResizing"), false);
export const resizingClass = signal(path("htmlrunner", "ui", "resizingClass"), "");
effect(() => {
  const parts: string[] = [];
  if (darkModeState.get()) parts.push("dark-mode");
  const rc = resizingClass.get();
  if (rc) parts.push(rc);
  bodyClass.set(parts.join(" "));
});

export const globalActions = signal<Partial<Actions>>(
  path("htmlrunner", "global", "actions"),
  {},
);

export const cursorPos = signal(path("htmlrunner", "ui", "cursorPos"), { line: 1, col: 1 });

effect(() => {
  if (!stateHydrated.get()) return;

  const snapshot = createStateSnapshot();
  const snapshotStr = JSON.stringify(snapshot);

  if (snapshotStr === _lastPersistedSnapshot) return;

  if (_idleHandle != null && window.cancelIdleCallback) {
    window.cancelIdleCallback(_idleHandle);
    _idleHandle = null;
  }
  if (_timeoutHandle != null) {
    clearTimeout(_timeoutHandle);
    _timeoutHandle = null;
  }

  const writeNow = () => {
    try {
      localStorage.setItem(STORAGE_KEY, snapshotStr);
      _lastPersistedSnapshot = snapshotStr;
    } catch (e) {
      console.warn("Failed to persist state:", e);
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    _idleHandle = window.requestIdleCallback(
      () => {
        writeNow();
        _idleHandle = null;
      },
      { timeout: 1000 },
    );
  } else {
    _timeoutHandle = window.setTimeout(() => {
      writeNow();
      _timeoutHandle = null;
    }, 500);
  }

  return () => {
    if (_idleHandle != null && window.cancelIdleCallback) {
      window.cancelIdleCallback(_idleHandle);
      _idleHandle = null;
    }
    if (_timeoutHandle != null) {
      clearTimeout(_timeoutHandle);
      _timeoutHandle = null;
    }
  };
});

export function createStateSnapshot(): State {
  return {
    files: filesState.get(),
    activeFile: activeFileState.get(),
    activeOutput: activeOutputState.get(),
    splitSizes: splitSizesState.get(),
    darkMode: darkModeState.get(),
    autoRun: autoRunState.get(),
    logFilters: logFilters.get(),
  };
}

export function applyStateSnapshot(snapshot: Partial<State>): void {
  const files = snapshot.files;
  if (files && files.length > 0) {
    filesState.set(files);
    const requestedActive = snapshot.activeFile;
    const nextActive =
      requestedActive && files.some((f) => f.id === requestedActive)
        ? requestedActive
        : files[0]?.id;
    if (nextActive) activeFileState.set(nextActive);
  }

  if (snapshot.activeOutput) {
    activeOutputState.set(snapshot.activeOutput);
  }

  if (snapshot.splitSizes) {
    splitSizesState.set(snapshot.splitSizes);
  }

  if (snapshot.darkMode !== undefined) {
    darkModeState.set(snapshot.darkMode);
  }

  if (snapshot.autoRun !== undefined) {
    autoRunState.set(snapshot.autoRun);
  }

  if (snapshot.logFilters) {
    logFilters.set(snapshot.logFilters);
  }
}

export function markStateHydrated(): void {
  stateHydrated.set(true);
}

export function loadState(): void {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      applyStateSnapshot(parseStateSnapshot(JSON.parse(savedState)));
    }
    markStateHydrated();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    showError("Failed to load state: " + msg);
    markStateHydrated();
  }
}
