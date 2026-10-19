import {
  closeSearchPanel,
  openSearchPanel,
  searchPanelOpen,
} from "@codemirror/search";
import { bindEvent, effect } from "@nisoku/sairin";
import { copyToClipboard } from "./utils";
import { consoleEntries } from "./console";
import { editor } from "./editor";
import { logFilters } from "./appState";

export function toggleSearch(mode: "find" | "replace" = "find"): void {
  if (!editor.view) return;
  const isOpen = searchPanelOpen(editor.view.state);
  if (isOpen) {
    closeSearchPanel(editor.view);
  } else {
    openSearchPanel(editor.view);
  }

  window.requestAnimationFrame(() => {
    const selector =
      mode === "replace"
        ? '.cm-search input[name="replace"]'
        : '.cm-search input[name="search"]';
    const root = editor.view!.dom as HTMLElement;
    const field = root.querySelector(selector) as HTMLInputElement | null;
    field?.focus();
    field?.select();
  });
}

export function addGlobalSearchShortcuts(): void {
  const preventDefault = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "h")) {
      e.preventDefault();
      e.stopPropagation();
      toggleSearch(e.key === "f" ? "find" : "replace");
    }
  };
  window.addEventListener("keydown", preventDefault, true);
}

export function copyAllConsole(): void {
  const entries = consoleEntries.get();
  const text = entries
    .map((ev) => {
      const timestamp = new Date(ev.timestamp).toLocaleTimeString();
      const message = ev.data
        .map((d) => (typeof d === "object" ? JSON.stringify(d) : String(d)))
        .join(" ");
      return `${timestamp} ${message}`;
    })
    .join("\n");
  copyToClipboard(text);
}

export function copyEditorContent(): void {
  if (editor.view) {
    copyToClipboard(editor.view.state.doc.toString());
  }
}

export function initializeCopyButtons(): void {
  const container = document.getElementById("editor-container");
  if (container) {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.innerHTML = '<i class="far fa-copy"></i>';
    bindEvent(copyBtn, "click", () => {
      copyEditorContent();
      copyBtn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => {
        copyBtn.innerHTML = '<i class="far fa-copy"></i>';
      }, 2000);
    });
    container.appendChild(copyBtn);
  }

  const consoleTab = document.querySelector('.output-tabs .tab[data-output="console"]');
  if (consoleTab) {
    const copyAllBtn = document.createElement("button");
    copyAllBtn.className = "copy-btn";
    copyAllBtn.style.position = "static";
    copyAllBtn.style.marginLeft = "auto";
    copyAllBtn.style.opacity = "1";
    copyAllBtn.innerHTML = '<i class="far fa-copy"></i> Copy All';
    bindEvent(copyAllBtn, "click", () => {
      copyAllConsole();
      copyAllBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => {
        copyAllBtn.innerHTML = '<i class="far fa-copy"></i> Copy All';
      }, 2000);
    });
    consoleTab.parentElement?.appendChild(copyAllBtn);
  }
}

export function initializeLogFilters(outputTabsEl?: Element | null): void {
  const consoleTab = outputTabsEl || document.querySelector(".output-tabs");
  if (!consoleTab) return;
  if (consoleTab.querySelector(".console-filters")) return;

  const filtersDiv = document.createElement("div");
  filtersDiv.className = "console-filters";

  (["log", "error", "warn", "info"] as const).forEach((type) => {
    const button = document.createElement("button");
    button.className = `filter-toggle ${type}`;
    const icon =
      type === "log"
        ? "terminal"
        : type === "error"
          ? "times-circle"
          : type === "warn"
            ? "exclamation-triangle"
            : "info-circle";
    button.innerHTML = `<i class="fas fa-${icon}"></i>${type.charAt(0).toUpperCase() + type.slice(1)}`;

    bindEvent(button, "click", () => {
      const prev = logFilters.get();
      const set = new Set(prev);
      if (set.has(type)) set.delete(type);
      else set.add(type);
      logFilters.set(Array.from(set));
    });

    filtersDiv.appendChild(button);
  });

  consoleTab.insertBefore(filtersDiv, consoleTab.lastElementChild);

  const btnMap = new Map<string, HTMLButtonElement>();
  Array.from(filtersDiv.children).forEach((c) => {
    if (c instanceof HTMLButtonElement) {
      const classes = c.className.split(" ");
      for (const cls of classes) {
        if (["log", "error", "warn", "info"].includes(cls)) {
          btnMap.set(cls, c);
          break;
        }
      }
    }
  });

  effect(() => {
    const active = new Set(logFilters.get());
    for (const [type, btn] of btnMap) {
      if (active.has(type)) btn.classList.add("active");
      else btn.classList.remove("active");
    }
  });
}
