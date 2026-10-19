import { Buffer } from "buffer";
Object.assign(globalThis, { Buffer });

import "@fortawesome/fontawesome-free/css/all.min.css";

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
  autoRunState,
  darkModeState,
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
import { showError, showInfo } from "./ui";
import { normalizeInternalHref } from "./url";
import { isNavigationMessage, isOutputType } from "./types";
import { getById, queryOne } from "./dom";
import { closeInfoDialog } from "./dialogs";
import GitWorker from "./git.worker?worker&inline";

function handleNavigationMessage(event: MessageEvent<unknown>): void {
  if (event.origin !== location.origin) return;
  if (!isNavigationMessage(event.data)) return;
  const href = event.data.href;
  if (!href) return;

  const targetPath = normalizeInternalHref(href);
  const files = filesState.get();
  const target = files.find((f) => f.name === targetPath || f.id === targetPath);
  if (!target) return;

  switchToFile(target);
  runCode().catch(console.error);
}

function bindMainControls(): void {
  const previewEl = getById("preview", HTMLIFrameElement);
  const consoleEl = getById("console", HTMLDivElement);
  const termPanelEl = getById("terminal", HTMLElement);
  const bodyEl = document.body;

  const runBtn = queryOne(".btn-run", HTMLButtonElement);
  if (runBtn) bindEvent(runBtn, "click", () => actions.runCode());

  const formatBtn = queryOne(".btn-format", HTMLButtonElement);
  if (formatBtn) bindEvent(formatBtn, "click", () => void actions.formatCode());

  const autoRunBtn = queryOne(".btn-auto-run", HTMLButtonElement);
  if (autoRunBtn) {
    autoRunBtn.setAttribute("aria-pressed", String(autoRunState.get()));
    bindEvent(autoRunBtn, "click", () => actions.toggleAutoRun());
    effect(() => {
      const on = autoRunState.get();
      autoRunBtn.setAttribute("aria-pressed", String(on));
    });
  }

  const themeBtn = queryOne(".theme-toggle", HTMLButtonElement);
  if (themeBtn) {
    bindEvent(themeBtn, "click", () => actions.toggleDarkMode());
    effect(() => {
      themeBtn.setAttribute("aria-pressed", String(darkModeState.get()));
    });
  }

  const autoRunEl = document.getElementById("auto-run-status");
  if (autoRunEl) bindText(autoRunEl, autoRunText);

  const previewOpenBtn = document.getElementById("preview-open-btn");
  if (previewOpenBtn && previewEl) {
    // Only meaningful while the preview itself is the visible panel.
    effect(() => {
      const onPreview = activeOutputState.get() === "preview";
      previewOpenBtn.toggleAttribute("hidden", !onPreview);
    });
    bindEvent(previewOpenBtn, "click", () => {
      const src = previewEl.src;
      if (src && src !== "about:blank") {
        window.open(src, "_blank", "noopener");
      } else {
        showError("Run code first to preview");
      }
    });
  }

  bindClass(bodyEl, bodyClass);
  effect(() => {
    document.documentElement.classList.toggle("dark-mode", darkModeState.get());
  });

  const loadingEl = getById("loading", HTMLDivElement);
  if (loadingEl) {
    effect(() => {
      loadingEl.classList.toggle("active", loadingVisible.get());
    });
  }

  const errorEl = getById("error-message", HTMLDivElement);
  if (errorEl) {
    bindText(errorEl, errorMessage);
    bindVisibility(errorEl, errorVisible);
    effect(() => {
      const kind = toastKind.get();
      errorEl.classList.remove("error", "success", "info");
      errorEl.classList.add(kind);
    });
  }

  const themeIcon = queryOne(".theme-toggle i", HTMLElement);
  const themeLabelEl = queryOne(".theme-toggle span", HTMLElement);
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

  const outputPreviewTabEl = queryOne(
    '.output-tabs .tab[data-output="preview"]',
    HTMLElement,
  );
  const outputConsoleTabEl = queryOne(
    '.output-tabs .tab[data-output="console"]',
    HTMLElement,
  );
  const outputTerminalTabEl = queryOne(
    '.output-tabs .tab[data-output="terminal"]',
    HTMLElement,
  );

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

  const outputTablist = queryOne(".output-tablist", HTMLElement);
  if (outputTablist) {
    const outputTabEls: HTMLElement[] = [];
    for (const tab of Array.from(
      outputTablist.querySelectorAll<HTMLElement>(".tab[data-output]"),
    )) {
      const out = tab.dataset["output"];
      if (!isOutputType(out)) continue;
      outputTabEls.push(tab);

      effect(() => {
        const active = activeOutputState.get() === out;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
      });
    }

    const activateOutputTab = (tab: HTMLElement): void => {
      const out = tab.dataset["output"];
      if (!isOutputType(out)) return;
      actions.switchOutput(out);
      tab.focus();
    };

    outputTablist.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const tab = target?.closest<HTMLElement>(".tab") ?? null;
      if (!tab) return;
      const out = tab.dataset["output"];
      if (isOutputType(out)) actions.switchOutput(out);
    });

    outputTablist.addEventListener("keydown", (e) => {
      const current = (e.target as Element | null)?.closest<HTMLElement>(".tab");
      if (!current) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const index = outputTabEls.indexOf(current);
      if (index === -1) return;
      const next =
        e.key === "ArrowRight"
          ? outputTabEls[(index + 1) % outputTabEls.length]
          : outputTabEls[(index - 1 + outputTabEls.length) % outputTabEls.length];
      if (next) activateOutputTab(next);
    });
  }

  const cursorEl = document.getElementById("cursor-position");
  if (cursorEl) {
    effect(() => {
      const pos = cursorPos.get();
      cursorEl.textContent = `Ln ${pos.line}, Col ${pos.col}`;
    });
  }

  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;

    if (e.key === "Escape") {
      closeInfoDialog();
      return;
    }

    if (!mod) return;

    if (e.key === "Enter") {
      e.preventDefault();
      actions.runCode().catch(console.error);
    } else if (e.key.toLowerCase() === "s") {
      e.preventDefault();
      showInfo("Workspace saved");
    }
  });
}

function bindFileTabs(): void {
  const fileTabsEl = getById("file-tabs", HTMLElement);
  if (!fileTabsEl) return;

  effect(() => {
    const files = filesState.get();
    const activeId = activeFileState.get();
    void files;
    void activeId;
    renderFileTabs(fileTabsEl, files, activeId);
  });

  const activateTab = (id: string): void => {
    const tab = fileTabsEl.querySelector<HTMLElement>(
      `.file-tab[data-file="${CSS.escape(id)}"]`,
    );
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const addBtn = getById("file-tab-add", HTMLElement);
  if (addBtn) bindEvent(addBtn, "click", () => actions.addFile());

  fileTabsEl.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const tabEl = target.closest<HTMLElement>(".file-tab");
    const closeBtn = target.closest<HTMLElement>(".file-tab-close");

    if (closeBtn) {
      const id = closeBtn.dataset["file"];
      if (id) actions.closeFile(id);
    } else if (tabEl) {
      const id = tabEl.dataset["file"];
      if (id) {
        actions.switchFile(id);
        activateTab(id);
      }
    }
  });

  fileTabsEl.addEventListener("keydown", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const tabEl = target?.closest<HTMLElement>(".file-tab") ?? null;
    if (!tabEl) return;
    const id = tabEl.dataset["file"];
    if (!id) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      actions.switchFile(id);
      activateTab(id);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      actions.closeFile(id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const tabs = Array.from(
        fileTabsEl.querySelectorAll<HTMLElement>(".file-tab"),
      );
      const index = tabs.indexOf(tabEl);
      if (index === -1) return;
      const offset = e.key === "ArrowRight" ? 1 : -1;
      const nextId = tabs[(index + offset + tabs.length) % tabs.length]?.dataset[
        "file"
      ];
      if (!nextId) return;
      actions.switchFile(nextId);
      activateTab(nextId);
      window.requestAnimationFrame(() => {
        fileTabsEl
          .querySelector<HTMLElement>(
            `.file-tab[data-file="${CSS.escape(nextId)}"]`,
          )
          ?.focus();
      });
    }
  });

  fileTabsEl.addEventListener("contextmenu", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const tabEl = target?.closest<HTMLElement>(".file-tab") ?? null;
    const id = tabEl?.dataset["file"];
    if (id) {
      showTabContextMenu(e, id);
    }
  });
}

function bindFileTree(): void {
  const fileTreeEl = getById("file-tree", HTMLElement);
  if (!fileTreeEl) return;

  effect(() => {
    const files = filesState.get();
    const activeId = activeFileState.get();
    void files;
    void activeId;
    renderFileTree(fileTreeEl);
  });

  const openFile = (fileId: string): void => {
    actions.switchFile(fileId);
    const inTree = fileTreeEl.querySelector<HTMLElement>(
      `.file-tree-item[data-file="${CSS.escape(fileId)}"]`,
    );
    inTree?.scrollIntoView({ block: "nearest" });
  };

  fileTreeEl.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const fileItem = target.closest<HTMLElement>(".file-tree-item");
    const folder = fileItem
      ? null
      : target.closest<HTMLElement>(".file-tree-folder");

    if (fileItem) {
      const fileId = fileItem.dataset["file"];
      if (fileId) openFile(fileId);
    } else if (folder) {
      const path = folder.dataset["folder"];
      if (!path) return;
      if (expandedFolders.has(path)) {
        expandedFolders.delete(path);
      } else {
        expandedFolders.add(path);
      }
      renderFileTree(fileTreeEl);
    }
  });

  fileTreeEl.addEventListener("keydown", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const fileItem = target?.closest<HTMLElement>(".file-tree-item") ?? null;
    if (!fileItem) return;
    const fileId = fileItem.dataset["file"];
    if (!fileId) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFile(fileId);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      actions.closeFile(fileId);
    }
  });

  fileTreeEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const fileItem = target.closest<HTMLElement>(".file-tree-item");
    const folder = target.closest<HTMLElement>(".file-tree-folder");

    if (fileItem) {
      const fileId = fileItem.dataset["file"];
      if (fileId) showTabContextMenu(e, fileId);
    } else if (folder) {
      const folderPath = folder.dataset["folder"];
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
  const termEl = getById("terminal", HTMLElement);
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
