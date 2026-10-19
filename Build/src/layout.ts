import Split from "split.js";
import { editor } from "./editor";
import { isResizing, resizingClass, splitSizesState } from "./appState";

let splitInstance: Split.Instance | null = null;
let resizeTimeout: number | undefined;

function initializeSplit(): void {
  if (splitInstance) {
    splitInstance.destroy();
  }

  const direction = window.innerWidth <= 768 ? "vertical" : "horizontal";
  const editorPanel = document.getElementById("editor-panel");
  const outputPanel = document.getElementById("output-panel");

  if (!(editorPanel instanceof HTMLElement) || !(outputPanel instanceof HTMLElement)) {
    console.error("Split.js elements not found");
    return;
  }

  const _sizes = splitSizesState.get();
  const sizes =
    Array.isArray(_sizes) &&
    _sizes.length === 2 &&
    _sizes.every((n) => typeof n === "number" && isFinite(n) && n > 0)
      ? _sizes
      : [50, 50];

  splitInstance = Split([editorPanel, outputPanel], {
    sizes,
    minSize: 200,
    gutterSize: 10,
    snapOffset: 0,
    dragInterval: 1,
    direction,
    elementStyle: (_dimension, size, gutterSize) => ({
      "flex-basis": `calc(${size}% - ${gutterSize}px)`,
    }),
    gutterStyle: (_dimension, gutterSize) => ({
      "flex-basis": `${gutterSize}px`,
    }),
    onDragStart: function () {
      resizingClass.set(
        direction === "horizontal" ? "resizing-col" : "resizing-row",
      );
      isResizing.set(true);
    },
    onDrag: function () {
      if (editor.view) editor.view.requestMeasure();
    },
    onDragEnd: function (sizes) {
      resizingClass.set("");
      isResizing.set(false);
      splitSizesState.set(sizes);
      if (editor.view) editor.view.requestMeasure();
    },
  });

  setTimeout(() => {
    if (editor.view) editor.view.requestMeasure();
  }, 0);
}

const handleResize = () => {
  if (resizeTimeout) {
    window.clearTimeout(resizeTimeout);
  }
  resizeTimeout = window.setTimeout(() => {
    initializeSplit();
  }, 250);
};

export function initializeLayout(): void {
  initializeSplit();
  window.removeEventListener("resize", handleResize);
  window.addEventListener("resize", handleResize);
}

export function destroyLayout(): void {
  window.removeEventListener("resize", handleResize);
  if (resizeTimeout) window.clearTimeout(resizeTimeout);
  if (splitInstance) {
    splitInstance.destroy();
    splitInstance = null;
  }
}

let sidebarVisible = true;

export function toggleSidebar(): void {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  sidebarVisible = !sidebarVisible;
  sidebar.style.display = sidebarVisible ? "" : "none";
}
