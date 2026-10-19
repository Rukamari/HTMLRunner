import {
  closeSearchPanel,
  openSearchPanel,
  searchPanelOpen,
} from "@codemirror/search";
import { bindEvent, effect } from "@nisoku/sairin";
import { copyToClipboard } from "./utils";
import { consoleEntries } from "./console";
import { editor } from "./editor";
import { activeOutputState, logFilters } from "./appState";
import { LOG_LEVELS, isLogLevel, type LogLevel } from "./types";
import { queryOne } from "./dom";

export function toggleSearch(mode: "find" | "replace" = "find"): void {
  if (!editor.view) return;
  const isOpen = searchPanelOpen(editor.view.state);
  if (isOpen) {
    closeSearchPanel(editor.view);
  } else {
    openSearchPanel(editor.view);
  }

  window.requestAnimationFrame(() => {
    if (!editor.view) return;
    const selector =
      mode === "replace"
        ? '.cm-search input[name="replace"]'
        : '.cm-search input[name="search"]';
    const field = queryOne(selector, HTMLInputElement, editor.view.dom);
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
    copyBtn.type = "button";
    copyBtn.className = "copy-btn";
    copyBtn.title = "Copy file contents";
    copyBtn.setAttribute("aria-label", "Copy file contents");
    copyBtn.innerHTML = '<i class="far fa-copy" aria-hidden="true"></i>';
    bindEvent(copyBtn, "click", () => {
      copyEditorContent();
      copyBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
      setTimeout(() => {
        copyBtn.innerHTML =
          '<i class="far fa-copy" aria-hidden="true"></i>';
      }, 2000);
    });
    container.appendChild(copyBtn);
  }

  const consoleTab = queryOne('.output-tabs .tab[data-output="console"]', HTMLElement);
  const outputTabs = queryOne(".output-tabs", HTMLElement);
  if (consoleTab && outputTabs) {
    const copyAllBtn = document.createElement("button");
    copyAllBtn.type = "button";
    copyAllBtn.className = "copy-btn copy-all-btn";
    copyAllBtn.title = "Copy all console output";
    copyAllBtn.setAttribute("aria-label", "Copy all console output");
    copyAllBtn.innerHTML =
      '<i class="far fa-copy" aria-hidden="true"></i> Copy All';
    effect(() => {
      copyAllBtn.toggleAttribute(
        "hidden",
        activeOutputState.get() !== "console",
      );
    });
    bindEvent(copyAllBtn, "click", () => {
      copyAllConsole();
      copyAllBtn.innerHTML =
        '<i class="fas fa-check" aria-hidden="true"></i> Copied!';
      setTimeout(() => {
        copyAllBtn.innerHTML =
          '<i class="far fa-copy" aria-hidden="true"></i> Copy All';
      }, 2000);
    });
    outputTabs.appendChild(copyAllBtn);
  }
}

export function initializeLogFilters(outputTabsEl?: Element | null): void {
  const consoleTab = outputTabsEl || document.querySelector(".output-tabs");
  if (!consoleTab) return;
  if (consoleTab.querySelector(".console-filters")) return;

  const filtersDiv = document.createElement("div");
  filtersDiv.className = "console-filters";

  const filterIcons: Record<LogLevel, string> = {
    log: "terminal",
    error: "times-circle",
    warn: "exclamation-triangle",
    info: "info-circle",
  };

  for (const type of LOG_LEVELS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-toggle ${type}`;
    button.title = `Toggle ${type} messages`;
    button.setAttribute("aria-label", `Toggle ${type} messages`);
    const icon = document.createElement("i");
    icon.className = `fas fa-${filterIcons[type]}`;
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);
    button.appendChild(
      document.createTextNode(type.charAt(0).toUpperCase() + type.slice(1)),
    );

    bindEvent(button, "click", () => {
      const prev = logFilters.get();
      const set = new Set(prev);
      if (set.has(type)) set.delete(type);
      else set.add(type);
      logFilters.set(Array.from(set));
    });

    filtersDiv.appendChild(button);
  }

  consoleTab.insertBefore(filtersDiv, consoleTab.lastElementChild);

  const btnMap = new Map<LogLevel, HTMLButtonElement>();
  Array.from(filtersDiv.children).forEach((c) => {
    if (c instanceof HTMLButtonElement) {
      const classes = c.className.split(" ");
      for (const cls of classes) {
        if (isLogLevel(cls)) {
          btnMap.set(cls, c);
          break;
        }
      }
    }
  });

  effect(() => {
    const active = new Set(logFilters.get());
    for (const [type, btn] of btnMap) {
      const on = active.has(type);
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    }
  });
}
