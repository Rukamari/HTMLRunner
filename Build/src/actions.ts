import { redo as cmRedo, undo as cmUndo } from "@codemirror/commands";
import { globalActions } from "./appState";
import { clearConsole } from "./console";
import { editor } from "./editor";
import { formatCode, runCode } from "./runner";
import {
  addFileAction,
  addFolderAction,
  closeAllAction,
  closeFileAction,
  closeOthersAction,
  duplicateFileAction,
  exportAsZip,
  importFilesAction,
  renameFileAction,
  resetWorkspaceAction,
  switchFileAction,
} from "./fileActions";
import { copyAllConsole, copyEditorContent, toggleSearch } from "./bindings";
import { switchOutput, toggleAutoRun, toggleDarkMode } from "./ui";
import type { Actions } from "./types";

export function undoAction(): void {
  if (editor.view) cmUndo(editor.view);
}

export function redoAction(): void {
  if (editor.view) cmRedo(editor.view);
}

export const actions = {
  runCode,
  clearConsole,
  resetCode: resetWorkspaceAction,
  formatCode,
  switchFile: switchFileAction,
  addFile: addFileAction,
  addFolder: addFolderAction,
  closeFile: closeFileAction,
  importFiles: importFilesAction,
  renameFile: renameFileAction,
  duplicateFile: duplicateFileAction,
  closeOthers: closeOthersAction,
  closeAll: closeAllAction,
  switchOutput,
  exportAsZip,
  copyAllConsole,
  copyEditorContent,
  toggleSearch,
  toggleAutoRun,
  toggleDarkMode,
} satisfies Actions;

export function registerGlobalActions(): void {
  globalActions.set({
    ...actions,
    undo: undoAction,
    redo: redoAction,
  });
}

registerGlobalActions();
