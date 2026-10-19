import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { executeCommand, setTerminalWriters } from "./shell";
import {
  applyTerminalKey,
  EMPTY_LINE,
  type TerminalLineState,
} from "./terminalLine";

let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let container: HTMLElement | null = null;
let line: TerminalLineState = EMPTY_LINE;
const history: string[] = [];
let historyIndex = -1;

const PROMPT = "$ ";
const MAX_HISTORY = 100;

export function getTerminal(): Terminal | null {
  return term;
}

function redrawLine(): void {
  if (!term) return;
  term.write(`\r\x1b[2K${PROMPT}${line.buffer}`);
  const back = line.buffer.length - line.cursor;
  if (back > 0) term.write(`\x1b[${back}D`);
}

function restorePrompt(): void {
  line = EMPTY_LINE;
  historyIndex = -1;
  term?.write(PROMPT);
}

function useHistoryEntry(entry: string): void {
  line = { buffer: entry, cursor: entry.length };
  redrawLine();
}

async function submitLine(): Promise<void> {
  const cmd = line.buffer;
  term?.writeln("");
  line = EMPTY_LINE;
  historyIndex = -1;
  if (!cmd.trim()) {
    term?.write(PROMPT);
    return;
  }
  if (history[history.length - 1] !== cmd) {
    history.push(cmd);
    if (history.length > MAX_HISTORY) history.shift();
  }
  await executeCommand(cmd).finally(() => {
    term?.write(PROMPT);
  });
}

export function createTerminal(el: HTMLElement): void {
  container = el;
  container.innerHTML = "";

  fitAddon = new FitAddon();

  term = new Terminal({
    cursorBlink: true,
    cursorStyle: "bar",
    fontSize: 13,
    fontFamily: "'Courier New', 'Consolas', monospace",
    rows: 10,
    theme: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
      cursor: "#d4d4d4",
      selectionBackground: "#264f78",
      black: "#000000",
      red: "#cd3131",
      green: "#0dbc79",
      yellow: "#e5e510",
      blue: "#2472c8",
      magenta: "#bc3fbc",
      cyan: "#11a8cd",
      white: "#e5e5e5",
      brightBlack: "#666666",
      brightRed: "#f14c4c",
      brightGreen: "#23d18b",
      brightYellow: "#f5f543",
      brightBlue: "#3b8eea",
      brightMagenta: "#d670d6",
      brightCyan: "#29b8db",
      brightWhite: "#e5e5e5",
    },
  });

  term.loadAddon(fitAddon);
  term.open(el);

  setTerminalWriters(
    (text) => term?.write(text),
    (text) => term?.writeln(text),
  );

  term.write("Welcome to HTMLRunner terminal\r\n");
  term.write(PROMPT);

  line = EMPTY_LINE;

  term.onKey((e) => {
    const { key, domEvent } = e;
    const result = applyTerminalKey(line, key, domEvent.ctrlKey);
    line = result.state;

    switch (result.action) {
      case "interrupt":
        term?.write("^C\r\n");
        restorePrompt();
        return;
      case "clear-screen":
        term?.write("\x1b[2J\x1b[H");
        redrawLine();
        return;
      case "submit":
        void submitLine();
        return;
      case "history-prev":
        if (history.length > 0) {
          const idx =
            historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
          const entry = history[idx];
          if (entry !== undefined) {
            historyIndex = idx;
            useHistoryEntry(entry);
          }
        }
        return;
      case "history-next":
        if (historyIndex >= 0) {
          const idx = historyIndex + 1;
          if (idx >= history.length) {
            historyIndex = -1;
            useHistoryEntry("");
          } else {
            const entry = history[idx];
            if (entry !== undefined) {
              historyIndex = idx;
              useHistoryEntry(entry);
            }
          }
        }
        return;
      case "none":
        if (result.redraw) redrawLine();
        return;
    }
  });

  requestAnimationFrame(() => {
    fitAddon?.fit();
  });
}

export function fitTerminal(): void {
  try {
    fitAddon?.fit();
  } catch {
  }
}

export function clearTerminal(): void {
  term?.clear();
  term?.write(PROMPT);
}
