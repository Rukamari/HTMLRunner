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

let activeMenu: string | null = null;

export function initializeMenuBar(): void {
  const menuItems = document.querySelectorAll(".menu-item");
  const dropdowns = document.querySelectorAll(".menu-dropdown");

  function closeAllMenus() {
    activeMenu = null;
    dropdowns.forEach((d) => d.classList.remove("open"));
  }

  menuItems.forEach((item) => {
    const menuId = (item as HTMLElement).dataset.menu;
    if (!menuId) return;

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById(`menu-${menuId}`);
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
        const dropdown = document.getElementById(`menu-${menuId}`);
        if (!dropdown) return;
        const prev = document.getElementById(`menu-${activeMenu}`);
        if (prev) prev.classList.remove("open");
        const rect = item.getBoundingClientRect();
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.classList.add("open");
        activeMenu = menuId;
      }
    });
  });

  // Handle menu dropdown item clicks
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".menu-dropdown-item") as HTMLElement | null;
    if (!item) return;

    const action = item.dataset.action;
    if (!action) return;

    closeAllMenus();

    // Parse compound actions
    if (action.startsWith("switchOutput-")) {
      switchOutput(action.slice("switchOutput-".length));
      return;
    }
    if (action === "toggleSearch") {
      toggleSearch("find");
      return;
    }
    if (action === "toggleReplace") {
      toggleSearch("replace");
      return;
    }

    // Direct actions
    const actionMap: Record<string, () => void> = {
      addFile: () => addFileAction(),
      addFolder: () => addFolderAction(),
      importFiles: () => importFilesAction(),
      exportAsZip: () => { exportAsZip().catch(console.error); },

      resetCode: () => resetWorkspaceAction(),
      undo: () => undoAction(),
      redo: () => redoAction(),
      formatCode: () => { formatCode().catch(console.error); },
      toggleSidebar: () => toggleSidebar(),
      toggleDarkMode: () => toggleDarkMode(),
      toggleAutoRun: () => toggleAutoRun(),
      runCode: () => { runCode().catch(console.error); },
      clearConsole: () => clearConsole(),
      gitStatus: () => { showGitStatus().catch(console.error); },
      gitCommit: () => { commitAction().catch(console.error); },
      gitDiff: () => { showGitDiff().catch(console.error); },
      gitLog: () => { showGitLog().catch(console.error); },
      gitPush: () => { pushAction().catch(console.error); },
      gitPull: () => { pullAction().catch(console.error); },
      gitClone: () => { cloneAction().catch(console.error); },
      about: () => showAbout(),
      openShortcuts: () => showShortcuts(),
    };

    const fn = actionMap[action];
    if (fn) fn();
  });

  // Close menus on outside click
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".menu-item") && !target.closest(".menu-dropdown")) {
      closeAllMenus();
    }
  });

  // Close menus on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllMenus();
  });
}
