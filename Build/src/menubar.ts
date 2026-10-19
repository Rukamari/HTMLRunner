import {
  addFileAction,
  addFolderAction,
  exportAsZip,
  importFilesAction,
  resetWorkspaceAction,
} from "./fileActions";
import { clearConsole } from "./console";
import { formatCode, runCode } from "./runner";
import { showAbout, showShortcuts } from "./dialogs";
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
} satisfies Record<MenuAction, () => void>;

let activeMenu: string | null = null;

export function initializeMenuBar(): void {
  const menuItems = document.querySelectorAll(".menu-item");
  const dropdowns = document.querySelectorAll(".menu-dropdown");

  function closeAllMenus(): void {
    activeMenu = null;
    dropdowns.forEach((d) => d.classList.remove("open"));
  }

  menuItems.forEach((item) => {
    if (!(item instanceof HTMLElement)) return;
    const menuId = item.dataset["menu"];
    if (!menuId) return;

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdown = getById(`menu-${menuId}`, HTMLElement);
      if (!dropdown) return;

      if (activeMenu === menuId) {
        closeAllMenus();
        return;
      }

      closeAllMenus();
      const rect = item.getBoundingClientRect();
      dropdown.style.left = `${rect.left}px`;
      dropdown.style.top = `${rect.bottom}px`;
      dropdown.classList.add("open");
      activeMenu = menuId;
    });

    item.addEventListener("mouseenter", () => {
      if (activeMenu && activeMenu !== menuId) {
        const dropdown = getById(`menu-${menuId}`, HTMLElement);
        if (!dropdown) return;
        const prev = getById(`menu-${activeMenu}`, HTMLElement);
        if (prev) prev.classList.remove("open");
        const rect = item.getBoundingClientRect();
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.classList.add("open");
        activeMenu = menuId;
      }
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
    if (e.key === "Escape") closeAllMenus();
  });
}
