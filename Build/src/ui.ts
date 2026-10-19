import {
  activeOutputState,
  autoRunState,
  darkModeState,
  errorMessage,
  loadingVisible,
  toastKind,
  type ToastKind,
} from "./appState";
import type { OutputType } from "./types";
import { setAutoRun, setDarkMode } from "./editor";

const TOAST_DURATION_MS = 5000;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showLoading(): void {
  loadingVisible.set(true);
}

export function hideLoading(): void {
  loadingVisible.set(false);
}

export function showToast(message: string, kind: ToastKind = "info"): void {
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
  }
  toastKind.set(kind);
  errorMessage.set(message);
  toastTimer = setTimeout(() => {
    toastTimer = null;
    errorMessage.set("");
  }, TOAST_DURATION_MS);
}

export function showError(message: string): void {
  showToast(message, "error");
}

export function showSuccess(message: string): void {
  showToast(message, "success");
}

export function showInfo(message: string): void {
  showToast(message, "info");
}

export function switchOutput(output: OutputType): void {
  activeOutputState.set(output);
}

export function toggleAutoRun(): void {
  const newAutoRun = !autoRunState.get();
  setAutoRun(newAutoRun);
}

export function toggleDarkMode(): void {
  const newDarkMode = !darkModeState.get();
  setDarkMode(newDarkMode);
}
