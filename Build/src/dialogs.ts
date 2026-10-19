export function showInfoDialog(title: string, body: string): void {
  document.querySelector(".info-dialog-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "info-dialog-overlay";
  overlay.addEventListener("click", () => overlay.remove());

  const dialog = document.createElement("div");
  dialog.className = "info-dialog";
  dialog.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "info-dialog-header";
  header.textContent = title;

  const closeBtn = document.createElement("button");
  closeBtn.className = "info-dialog-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(closeBtn);

  const bodyEl = document.createElement("pre");
  bodyEl.className = "info-dialog-body";
  bodyEl.textContent = body;

  dialog.appendChild(header);
  dialog.appendChild(bodyEl);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
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
    `Ctrl/Cmd + Enter    Run code\nCtrl/Cmd + F        Find\nCtrl/Cmd + H        Find & Replace\nCtrl/Cmd + /        Toggle comment\nCtrl/Cmd + Z        Undo\nCtrl/Cmd + Y        Redo\nTab / Shift+Tab     Indent / Unindent\nEsc                 Close menus`,
  );
}
