import {
  addFileAction,
  addFolderAction,
  exportAsZip,
  importFilesAction,
  resetWorkspaceAction,
} from "./fileActions";
import { clearConsole, toggleTimestamps } from "./console";
import { formatCode, runCode } from "./runner";
import { showAbout, showShortcuts } from "./dialogs";
import { showDiagnostics } from "./diagnostics";
import {
  cloneAction,
  commitAction,
  pullAction,
  pushAction,
  showGitDiff,
  showGitLog,
  showGitStatus,
} from "./gitUi";
import { toggleSidebar } from "./layout";
import { redoAction, undoAction } from "./actions";
import { toggleSearch } from "./bindings";
import { switchOutput, toggleAutoRun, toggleDarkMode } from "./ui";
import { isOutputType } from "./types";
import { getById } from "./dom";

const MENU_ACTIONS = [
  "addFile",
  "addFolder",
  "importFiles",
  "exportAsZip",
  "resetCode",
  "undo",
  "redo",
  "toggleSearch",
  "toggleReplace",
  "formatCode",
  "toggleSidebar",
  "toggleDarkMode",
  "toggleAutoRun",
  "toggleTimestamps",
  "runCode",
  "clearConsole",
  "gitStatus",
  "gitCommit",
  "gitDiff",
  "gitLog",
  "gitPush",
  "gitPull",
  "gitClone",
  "about",
  "openShortcuts",
  "diagnostics",
] as const;

type MenuAction = (typeof MENU_ACTIONS)[number];

const MENU_ACTION_NAMES: ReadonlySet<string> = new Set(MENU_ACTIONS);
const OUTPUT_ACTION_PREFIX = "switchOutput-";

function isMenuAction(value: string): value is MenuAction {
  return MENU_ACTION_NAMES.has(value);
}

const MENU_ACTION_MAP = {
  addFile: () => addFileAction(),
  addFolder: () => addFolderAction(),
  importFiles: () => importFilesAction(),
  exportAsZip: () => {
    exportAsZip().catch(console.error);
  },
  resetCode: () => resetWorkspaceAction(),
  undo: () => undoAction(),
  redo: () => redoAction(),
  toggleSearch: () => toggleSearch("find"),
  toggleReplace: () => toggleSearch("replace"),
  formatCode: () => {
    formatCode().catch(console.error);
  },
  toggleSidebar: () => toggleSidebar(),
  toggleDarkMode: () => toggleDarkMode(),
  toggleAutoRun: () => toggleAutoRun(),
  toggleTimestamps: () => toggleTimestamps(),
  runCode: () => {
    runCode().catch(console.error);
  },
  clearConsole: () => clearConsole(),
  gitStatus: () => {
    showGitStatus().catch(console.error);
  },
  gitCommit: () => {
    commitAction().catch(console.error);
  },
  gitDiff: () => {
    showGitDiff().catch(console.error);
  },
  gitLog: () => {
    showGitLog().catch(console.error);
  },
  gitPush: () => {
    pushAction().catch(console.error);
  },
  gitPull: () => {
    pullAction().catch(console.error);
  },
  gitClone: () => {
    cloneAction().catch(console.error);
  },
  about: () => showAbout(),
  openShortcuts: () => showShortcuts(),
  diagnostics: () => showDiagnostics(),
} satisfies Record<MenuAction, () => void>;

let activeMenu: string | null = null;

export function initializeMenuBar(): void {
  const menuItems = Array.from(document.querySelectorAll(".menu-item")).filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  );
  const dropdowns = document.querySelectorAll(".menu-dropdown");

  function closeAllMenus(): void {
    activeMenu = null;
    dropdowns.forEach((d) => d.classList.remove("open"));
    menuItems.forEach((item) => item.setAttribute("aria-expanded", "false"));
  }

  function openMenu(menuId: string, item: HTMLElement): void {
    closeAllMenus();
    const dropdown = getById(`menu-${menuId}`, HTMLElement);
    if (!dropdown) return;

    const rect = item.getBoundingClientRect();
    dropdown.classList.add("open");
    const maxLeft = Math.max(4, window.innerWidth - dropdown.offsetWidth - 4);
    const maxTop = Math.max(4, window.innerHeight - dropdown.offsetHeight - 4);
    dropdown.style.left = `${Math.min(rect.left, maxLeft)}px`;
    dropdown.style.top = `${Math.min(rect.bottom, maxTop)}px`;
    item.setAttribute("aria-expanded", "true");
    activeMenu = menuId;
  }

  function moveMenuFocus(offset: number): void {
    if (menuItems.length === 0) return;
    const openIndex = menuItems.findIndex(
      (item) => item.dataset["menu"] === activeMenu,
    );
    if (openIndex === -1) {
      const focused = menuItems.findIndex((item) => item === document.activeElement);
      const index = (focused + offset + menuItems.length) % menuItems.length;
      menuItems[index]?.focus();
      return;
    }
    const index = (openIndex + offset + menuItems.length) % menuItems.length;
    const item = menuItems[index];
    if (!item) return;
    const menuId = item.dataset["menu"];
    if (menuId) openMenu(menuId, item);
    item.focus();
  }

  menuItems.forEach((item) => {
    const menuId = item.dataset["menu"];
    if (!menuId) return;

    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-haspopup", "true");
    item.setAttribute("aria-expanded", "false");

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      if (activeMenu === menuId) {
        closeAllMenus();
        return;
      }
      openMenu(menuId, item);
    });

    item.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu(menuId, item);
        const first = getById(`menu-${menuId}`, HTMLElement)?.querySelector(
          ".menu-dropdown-item",
        );
        if (first instanceof HTMLElement) first.focus();
      }
    });

    item.addEventListener("mouseenter", () => {
      if (activeMenu && activeMenu !== menuId) openMenu(menuId, item);
    });
  });

  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const item = target?.closest<HTMLElement>(".menu-dropdown-item") ?? null;
    if (!item) return;

    const action = item.dataset["action"];
    if (!action) return;

    closeAllMenus();

    if (action.startsWith(OUTPUT_ACTION_PREFIX)) {
      const output = action.slice(OUTPUT_ACTION_PREFIX.length);
      if (isOutputType(output)) switchOutput(output);
      return;
    }

    if (!isMenuAction(action)) return;

    MENU_ACTION_MAP[action]();
  });

  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target?.closest(".menu-item") && !target?.closest(".menu-dropdown")) {
      closeAllMenus();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllMenus();
      return;
    }
    if (!activeMenu) return;

    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".menu-dropdown")) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const siblings = Array.from(
          active.parentElement?.querySelectorAll<HTMLElement>(
            ".menu-dropdown-item",
          ) ?? [],
        );
        if (siblings.length === 0) return;
        const idx = siblings.indexOf(active);
        const offset = e.key === "ArrowDown" ? 1 : -1;
        siblings[(idx + offset + siblings.length) % siblings.length]?.focus();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        active.click();
        return;
      }
    }

    if (
      (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
      active?.classList.contains("menu-item")
    ) {
      e.preventDefault();
      moveMenuFocus(e.key === "ArrowRight" ? 1 : -1);
    }
  });
}
