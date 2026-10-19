import type {
  ConsoleMessage,
  LogLevel,
  StackInfo,
} from "./types";
import { isConsoleMessage, isRecord } from "./types";
import { editor } from "./editor";
import { signal, effect, path } from "@nisoku/sairin";
import { logFilters } from "./appState";
import { getById } from "./dom";

export const consoleEntries = signal(
  path("htmlrunner", "console", "entries"),
  [] as ConsoleMessage[],
);

/** Keep memory bounded when the preview logs in a tight loop. */
const MAX_CONSOLE_ENTRIES = 1000;

function pushConsoleEntry(entry: ConsoleMessage): void {
  const prev = consoleEntries.get();
  const next =
    prev.length >= MAX_CONSOLE_ENTRIES
      ? [...prev.slice(prev.length - MAX_CONSOLE_ENTRIES + 1), entry]
      : [...prev, entry];
  consoleEntries.set(next);
}

let consoleOutputEl: HTMLDivElement | null = null;

function renderConsoleEntries(
  entries: ConsoleMessage[],
  filters: LogLevel[] = logFilters.get(),
): void {
  if (!consoleOutputEl) return;
  const activeFilters = new Set(filters);
  const frag = document.createDocumentFragment();
  for (const ev of entries) {
    const entry = document.createElement("div");
    const filtered = !activeFilters.has(ev.level);
    entry.className = `console-entry${filtered ? " filtered" : ""}`;

    const timestamp = document.createElement("span");
    timestamp.className = "timestamp";
    timestamp.textContent = new Date(ev.timestamp).toLocaleTimeString();

    const message = document.createElement("span");
    message.className = `console-${ev.level}`;
    ev.data.forEach((item, i) => {
      if (i > 0) message.appendChild(document.createTextNode(" "));
      if (item && typeof item === "object") {
        message.appendChild(renderObject(item));
      } else {
        message.appendChild(document.createTextNode(String(item)));
      }
    });

    const maybeStack = ev.data.length > 1 ? ev.data[1] : undefined;
    if (isRecord(maybeStack) && typeof maybeStack["stack"] === "string") {
      const stack = document.createElement("div");
      stack.className = "console-stack";
      const rawStack = maybeStack["stack"];
      rawStack.split("\n").forEach((line) => {
        const lineEl = document.createElement("div");
        lineEl.className = "console-stack-line";
        lineEl.textContent = line.trim();

        let lineNum: number | undefined;
        let colNum: number | undefined;
        const patterns: RegExp[] = [
          /\(([^)]+):(\d+):(\d+)\)$/,
          /([^@()\s]+):(\d+):(\d+)$/,
          /([^@()\s]+):(\d+)$/,
        ];
        for (const pat of patterns) {
          const m = line.match(pat);
          const lineText = m?.[2];
          if (!lineText) continue;
          lineNum = parseInt(lineText, 10);
          const colText = m?.[3];
          if (colText) colNum = parseInt(colText, 10);
          break;
        }

        const targetLine = lineNum;
        if (targetLine !== undefined) {
          lineEl.classList.add("clickable");
          lineEl.addEventListener("click", () => {
            if (!editor.view) return;
            const doc = editor.view.state.doc;
            const maxLine = doc.lines;
            const safeLine = Math.max(1, Math.min(targetLine, maxLine));
            const lineObj = doc.line(safeLine);
            const offset = Math.min(
              lineObj.to,
              lineObj.from + Math.max(0, (colNum ?? 1) - 1),
            );
            editor.view.dispatch({ selection: { anchor: offset } });
            editor.view.focus();
          });
        }
        stack.appendChild(lineEl);
      });
      stack.addEventListener("click", (e) => {
        if (e.target === stack) stack.classList.toggle("expanded");
      });
      message.appendChild(stack);
    }

    entry.appendChild(timestamp);
    entry.appendChild(document.createTextNode(" "));
    entry.appendChild(message);
    frag.appendChild(entry);
  }
  consoleOutputEl.replaceChildren(frag);
  consoleOutputEl.scrollTop = consoleOutputEl.scrollHeight;
}

effect(() => {
  const entries = consoleEntries.get();
  const filters = logFilters.get();
  if (!consoleOutputEl) return;
  renderConsoleEntries(entries, filters);
});

export const consoleInterceptor = `
const _orig={log:console.log,error:console.error,warn:console.warn,info:console.info};
function _send(l,...a){
  try{window.parent.postMessage({type:'console',level:l,data:a,timestamp:new Date().toISOString()},location.origin)}catch{}
  _orig[l].apply(console,a)
}
console.log=(...a)=>_send('log',...a);
console.error=(...a)=>_send('error',...a);
console.warn=(...a)=>_send('warn',...a);
console.info=(...a)=>_send('info',...a);
window.onerror=(m,s,l,c,e)=>{_send('error',e||m,{stack:e?.stack});return true};
window.onunhandledrejection=e=>{_send('error',e.reason,{stack:e.reason?.stack})};
`;

export const navigationInterceptor = `
document.addEventListener('click', function(e) {
  var link = e.target.closest('a');
  if (!link || link.getAttribute('target') === '_blank') return;
  var href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) return;
  e.preventDefault();
  window.parent.postMessage({type:'navigate',href:href},location.origin);
});
`;

export function initializeConsole(): void {
  consoleOutputEl = getById("console", HTMLDivElement);
  if (consoleOutputEl) renderConsoleEntries(consoleEntries.get());
  window.addEventListener("message", handleConsoleMessage);
}

function handleConsoleMessage(event: MessageEvent<unknown>): void {
  if (event.origin !== location.origin) return;
  if (!isConsoleMessage(event.data)) return;
  pushConsoleEntry(event.data);
}

function renderObject(
  obj: unknown,
  level = 0,
  visited = new WeakSet<object>(),
): Node {
  if (obj === null) return document.createTextNode("null");
  if (
    typeof obj === "string" ||
    typeof obj === "number" ||
    typeof obj === "boolean"
  ) {
    return document.createTextNode(String(obj));
  }
  if (obj instanceof Error) {
    const errorEl = document.createElement("span");
    errorEl.className = "console-error";
    errorEl.textContent = `${obj.name}: ${obj.message}`;
    if (obj.stack) {
      errorEl.textContent += `\n${obj.stack.split("\n").slice(1).join("\n")}`;
    }
    const container = document.createElement("span");
    container.appendChild(errorEl);
    return container;
  }
  if (typeof obj !== "object") {
    return document.createTextNode(String(obj));
  }
  if (visited.has(obj)) return document.createTextNode("[Circular]");
  if (level > 3) return document.createTextNode("[...]");
  visited.add(obj);

  const container = document.createElement("span");
  const preview = document.createElement("span");
  preview.className = "console-object";
  const isArray = Array.isArray(obj);
  preview.textContent = isArray ? `Array(${obj.length})` : "{...}";
  const content = document.createElement("div");
  content.className = "console-object-content";

  if (isArray) {
    obj.forEach((value: unknown) => {
      const prop = document.createElement("div");
      prop.appendChild(renderObject(value, level + 1, visited));
      content.appendChild(prop);
    });
  } else {
    Object.entries(obj).forEach(([key, value]) => {
      const prop = document.createElement("div");
      prop.textContent = `${key}: `;
      prop.appendChild(renderObject(value, level + 1, visited));
      content.appendChild(prop);
    });
  }

  preview.addEventListener("click", (e) => {
    e.stopPropagation();
    preview.classList.toggle("expanded");
  });

  container.appendChild(preview);
  container.appendChild(content);
  return container;
}

export function clearConsole(): void {
  consoleEntries.set([]);
}

export function logConsoleError(message: string, stack: StackInfo = {}): void {
  const entry: ConsoleMessage = {
    type: "console",
    level: "error",
    data: [message, stack],
    timestamp: new Date().toISOString(),
  };
  pushConsoleEntry(entry);
}
