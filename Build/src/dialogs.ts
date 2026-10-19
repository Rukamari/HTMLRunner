let closeActiveDialog: (() => void) | null = null;

export function closeInfoDialog(): void {
  closeActiveDialog?.();
}

export function showInfoDialog(title: string, body: string): void {
  document.querySelector(".info-dialog-overlay")?.remove();

  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement("div");
  overlay.className = "info-dialog-overlay";

  const dialog = document.createElement("div");
  dialog.className = "info-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", title);
  dialog.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "info-dialog-header";

  const titleEl = document.createElement("span");
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "info-dialog-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "Close";
  closeBtn.setAttribute("aria-label", "Close dialog");
  header.appendChild(closeBtn);

  const bodyEl = document.createElement("pre");
  bodyEl.className = "info-dialog-body";
  bodyEl.textContent = body;

  dialog.appendChild(header);
  dialog.appendChild(bodyEl);
  overlay.appendChild(dialog);

  const close = (): void => {
    overlay.remove();
    document.removeEventListener("keydown", onKeyDown);
    closeActiveDialog = null;
    previouslyFocused?.focus();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Tab") {
      const focusable = dialog.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  overlay.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKeyDown);

  closeActiveDialog = close;
  document.body.appendChild(overlay);
  closeBtn.focus();
}

export function showAbout(): void {
  showInfoDialog(
    "About HTMLRunner",
    `HTMLRunner v2.0.0\n\nA browser-based HTML/CSS/JavaScript code editor\nwith live preview, console, and git integration.\n\nBuilt with:\n  - CodeMirror 6\n  - Vite\n  - almostnode (virtual runtime + dev server)\n  - wasm-git (libgit2 WASM)\n  - xterm.js\n  - Biome\n  - Prettier\n\nhttps://htmltoolkit.github.io/HTMLRunner/`,
  );
}

export function showShortcuts(): void {
  showInfoDialog(
    "Keyboard Shortcuts",
    `Ctrl/Cmd + Enter    Run code\nCtrl/Cmd + S        Save workspace\nCtrl/Cmd + F        Find\nCtrl/Cmd + H        Find & Replace\nCtrl/Cmd + /        Toggle comment\nCtrl/Cmd + Z        Undo\nCtrl/Cmd + Y        Redo\nTab / Shift+Tab     Indent / Unindent\nEsc                 Close menus and dialogs`,
  );
}
