import { Buffer } from "buffer";
Object.assign(globalThis, { Buffer });

import { createEditor, switchToFile } from "./editor";
import { createTerminal, fitTerminal } from "./terminal";
import { runCode } from "./runner";
import { initializeConsole } from "./console";
import {
  loadState,
  filesState,
  activeFileState,
  activeOutputState,
  bodyClass,
} from "./appState";
import {
  autoRunText,
  previewClass,
  consoleClass,
  terminalClass,
  loadingVisible,
  errorMessage,
  errorVisible,
  toastKind,
  themeLabel,
  themeIconClass,
  cursorPos,
} from "./appState";
import {
  bindEvent,
  bindText,
  bindVisibility,
  bindClass,
  effect,
} from "@nisoku/sairin";
import { actions } from "./actions";
import { initializeLayout, destroyLayout } from "./layout";
import {
  addGlobalSearchShortcuts,
  initializeCopyButtons,
  initializeLogFilters,
} from "./bindings";
import { initializeMenuBar } from "./menubar";
import {
  expandedFolders,
  renderFileTabs,
  renderFileTree,
} from "./fileTreeView";
import {
  showFolderContextMenu,
  showTabContextMenu,
} from "./fileActions";
import {
  commitAction,
  startGitStatusPolling,
} from "./gitUi";
import {
  initGitService,
  isGitReady,
  syncAllFilesToWorker,
} from "./git-service";
import { initBridge, syncFilesDebounced } from "./vfs-bridge";
import { showError } from "./ui";
import { normalizeInternalHref } from "./url";
import GitWorker from "./git.worker?worker&inline";

function handleNavigationMessage(event: MessageEvent): void {
  if (event.origin !== location.origin) return;
  if (event.data?.type !== "navigate") return;
  const href = event.data.href as string;
  if (!href) return;

  const targetPath = normalizeInternalHref(href);
  const files = filesState.get();
  const target = files.find((f) => f.name === targetPath || f.id === targetPath);
  if (!target) return;

  switchToFile(target);
  runCode().catch(console.error);
}

function bindMainControls(): void {
  const previewEl = document.getElementById("preview") as HTMLIFrameElement | null;
  const consoleEl = document.getElementById("console") as HTMLDivElement | null;
  const termPanelEl = document.getElementById("terminal") as HTMLElement | null;
  const bodyEl = document.body as HTMLElement;

  const runBtn = document.querySelector(".btn-run") as HTMLButtonElement | null;
  if (runBtn) bindEvent(runBtn, "click", () => actions.runCode());

  const formatBtn = document.querySelector(".btn-format") as HTMLButtonElement | null;
  if (formatBtn) bindEvent(formatBtn, "click", () => void actions.formatCode());

  const autoRunBtn = document.querySelector(".btn-auto-run") as HTMLButtonElement | null;
  if (autoRunBtn) bindEvent(autoRunBtn, "click", () => actions.toggleAutoRun());

  const themeBtn = document.querySelector(".theme-toggle") as HTMLButtonElement | null;
  if (themeBtn) bindEvent(themeBtn, "click", () => actions.toggleDarkMode());

  const autoRunEl = document.getElementById("auto-run-status");
  if (autoRunEl) bindText(autoRunEl, autoRunText);

  const previewOpenBtn = document.getElementById("preview-open-btn");
  if (previewOpenBtn && previewEl) {
    bindEvent(previewOpenBtn, "click", () => {
      const src = previewEl.src;
      if (src && src !== "about:blank") {
        window.open(src, "_blank");
      } else {
        showError("Run code first to preview");
      }
    });
  }

  bindClass(bodyEl, bodyClass);

  const loadingEl = document.getElementById("loading") as HTMLDivElement | null;
  if (loadingEl) {
    effect(() => {
      loadingEl.classList.toggle("active", loadingVisible.get());
    });
  }

  const errorEl = document.getElementById("error-message") as HTMLDivElement | null;
  if (errorEl) {
    bindText(errorEl, errorMessage);
    bindVisibility(errorEl, errorVisible);
    effect(() => {
      const kind = toastKind.get();
      errorEl.classList.remove("error", "success", "info");
      errorEl.classList.add(kind);
    });
  }

  const themeIcon = document.querySelector(".theme-toggle i") as HTMLElement | null;
  const themeLabelEl = document.querySelector(".theme-toggle span") as HTMLElement | null;
  if (themeLabelEl) bindText(themeLabelEl, themeLabel);
  if (themeIcon) bindClass(themeIcon, themeIconClass);

  effect(() => {
    const out = activeOutputState.get();
    if (previewEl)
      previewEl.className = out === "preview" ? "preview active" : "preview";
    if (consoleEl)
      consoleEl.className = out === "console" ? "console active" : "console";
    if (termPanelEl)
      termPanelEl.className = out === "terminal" ? "terminal-panel active" : "terminal-panel";
  });
  effect(() => {
    if (activeOutputState.get() === "terminal") {
      requestAnimationFrame(() => fitTerminal());
    }
  });

  const outputPreviewTabEl = document.querySelector(
    '.output-tabs .tab[data-output="preview"]',
  ) as HTMLElement | null;
  const outputConsoleTabEl = document.querySelector(
    '.output-tabs .tab[data-output="console"]',
  ) as HTMLElement | null;
  const outputTerminalTabEl = document.querySelector(
    '.output-tabs .tab[data-output="terminal"]',
  ) as HTMLElement | null;

  if (outputPreviewTabEl) {
    effect(() => {
      outputPreviewTabEl.className = previewClass.get();
    });
  }
  if (outputConsoleTabEl) {
    effect(() => {
      outputConsoleTabEl.className = consoleClass.get();
    });
  }
  if (outputTerminalTabEl) {
    effect(() => {
      outputTerminalTabEl.className = terminalClass.get();
    });
  }

  const outputTabsContainer = document.querySelector(".output-tabs") as HTMLElement | null;
  if (outputTabsContainer) {
    outputTabsContainer.addEventListener("click", (e) => {
      const el = e.target as Element | null;
      const target = el?.closest(".tab") as HTMLElement | null;
      if (!target) return;
      const out = target.dataset.output;
      if (out) actions.switchOutput(out);
    });
  }

  const cursorEl = document.getElementById("cursor-position");
  if (cursorEl) {
    effect(() => {
      const pos = cursorPos.get();
      cursorEl.textContent = `Ln ${pos.line}, Col ${pos.col}`;
    });
  }
}

function bindFileTabs(): void {
  const fileTabsEl = document.getElementById("file-tabs") as HTMLElement | null;
  if (!fileTabsEl) return;

  effect(() => {
    const files = filesState.get();
    const activeId = activeFileState.get();
    renderFileTabs(fileTabsEl, files, activeId);
  });

  fileTabsEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const tabEl = target.closest(".file-tab") as HTMLElement | null;
    const closeBtn = target.closest(".file-tab-close") as HTMLElement | null;
    const addBtn = target.closest(".file-tab-add") as HTMLElement | null;

    if (closeBtn) {
      const id = closeBtn.dataset.file;
      if (id) actions.closeFile(id);
    } else if (addBtn) {
      actions.addFile();
    } else if (tabEl) {
      const id = tabEl.dataset.file;
      if (id) actions.switchFile(id);
    }
  });

  fileTabsEl.addEventListener("contextmenu", (e) => {
    const target = e.target as HTMLElement;
    const tabEl = target.closest(".file-tab") as HTMLElement | null;
    if (tabEl && tabEl.dataset.file) {
      showTabContextMenu(e, tabEl.dataset.file);
    }
  });
}

function bindFileTree(): void {
  const fileTreeEl = document.getElementById("file-tree") as HTMLElement | null;
  if (!fileTreeEl) return;

  effect(() => {
    renderFileTree(fileTreeEl);
  });

  fileTreeEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const fileItem = target.closest(".file-tree-item") as HTMLElement | null;
    const folder = !fileItem
      ? (target.closest(".file-tree-folder") as HTMLElement | null)
      : null;

    if (fileItem && fileItem.dataset.file) {
      actions.switchFile(fileItem.dataset.file);
    } else if (folder) {
      const path = folder.dataset.folder;
      if (!path) return;
      if (expandedFolders.has(path)) {
        expandedFolders.delete(path);
      } else {
        expandedFolders.add(path);
      }
      renderFileTree(fileTreeEl);
    }
  });

  fileTreeEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const fileItem = target.closest(".file-tree-item") as HTMLElement | null;
    const folder = target.closest(".file-tree-folder") as HTMLElement | null;

    if (fileItem && fileItem.dataset.file) {
      showTabContextMenu(e, fileItem.dataset.file);
    } else if (folder) {
      const folderPath = folder.dataset.folder;
      if (!folderPath) return;
      showFolderContextMenu(e, folderPath);
    }
  });
}

function bindSidebarButtons(): void {
  const newFileBtn = document.getElementById("sidebar-new-btn");
  if (newFileBtn) bindEvent(newFileBtn, "click", () => actions.addFile());

  const folderBtn = document.getElementById("sidebar-folder-btn");
  if (folderBtn) bindEvent(folderBtn, "click", () => actions.addFolder());

  const importBtn = document.getElementById("sidebar-import-btn");
  if (importBtn) bindEvent(importBtn, "click", () => actions.importFiles());

  const gitBtn = document.getElementById("sidebar-git-btn");
  if (gitBtn) bindEvent(gitBtn, "click", () => void commitAction());
}

document.addEventListener("DOMContentLoaded", async () => {
  const worker = new GitWorker();
  initGitService(worker);
  initBridge();

  const editorContainer = document.getElementById("editor-container");
  if (!editorContainer) {
    console.error("Editor container not found");
    return;
  }

  const initialFiles = filesState.get();
  const initialActiveId = activeFileState.get();
  const initialFile = initialFiles.find((f) => f.id === initialActiveId) ?? initialFiles[0];
  if (initialFile) {
    createEditor(editorContainer, initialFile);
  }

  initializeCopyButtons();

  loadState();

  initializeLayout();
  initializeLogFilters(document.querySelector(".output-tabs"));
  initializeConsole();
  const termEl = document.getElementById("terminal") as HTMLElement | null;
  if (termEl) {
    createTerminal(termEl);
  }
  window.addEventListener("resize", () => {
    fitTerminal();
  });

  window.addEventListener("message", handleNavigationMessage);
  addGlobalSearchShortcuts();
  initializeMenuBar();

  bindMainControls();
  bindFileTabs();
  bindFileTree();
  bindSidebarButtons();

  startGitStatusPolling();

  // Keep the sandbox VFS and git worker in sync with editor state.
  effect(() => {
    const files = filesState.get();
    if (isGitReady()) {
      syncFilesDebounced(files);
    }
  });

  window.addEventListener("beforeunload", () => {
    destroyLayout();
    void syncAllFilesToWorker().catch(() => {});
  });
});
