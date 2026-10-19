export interface TerminalLineState {
  buffer: string;
  cursor: number;
}

export type TerminalLineAction =
  | "none"
  | "submit"
  | "interrupt"
  | "clear-screen"
  | "history-prev"
  | "history-next";

export interface TerminalKeyResult {
  state: TerminalLineState;
  action: TerminalLineAction;
  redraw: boolean;
}

export const EMPTY_LINE: TerminalLineState = { buffer: "", cursor: 0 };

function clampCursor(cursor: number, buffer: string): number {
  return Math.max(0, Math.min(cursor, buffer.length));
}

function unchanged(state: TerminalLineState): TerminalKeyResult {
  return { state, action: "none", redraw: false };
}

export function applyTerminalKey(
  state: TerminalLineState,
  key: string,
  ctrl: boolean,
): TerminalKeyResult {
  const { buffer, cursor } = state;

  if (ctrl) {
    switch (key) {
      case "c":
        return {
          state: EMPTY_LINE,
          action: "interrupt",
          redraw: false,
        };
      case "l":
        return { state, action: "clear-screen", redraw: false };
      case "a":
        return { state: { buffer, cursor: 0 }, action: "none", redraw: cursor !== 0 };
      case "e":
        return {
          state: { buffer, cursor: buffer.length },
          action: "none",
          redraw: cursor !== buffer.length,
        };
      case "u":
        return {
          state: { buffer: buffer.slice(cursor), cursor: 0 },
          action: "none",
          redraw: cursor !== 0,
        };
      case "w": {
        const before = buffer.slice(0, cursor);
        const trimmed = before.replace(/\S+\s*$/, "");
        return {
          state: { buffer: trimmed + buffer.slice(cursor), cursor: trimmed.length },
          action: "none",
          redraw: trimmed.length !== cursor,
        };
      }
      default:
        return unchanged(state);
    }
  }

  switch (key) {
    case "\r":
      return {
        state: { buffer, cursor: buffer.length },
        action: "submit",
        redraw: false,
      };
    case "\x7f":
      if (cursor === 0) return unchanged(state);
      return {
        state: {
          buffer: buffer.slice(0, cursor - 1) + buffer.slice(cursor),
          cursor: cursor - 1,
        },
        action: "none",
        redraw: true,
      };
    case "\x1b[3~":
      if (cursor >= buffer.length) return unchanged(state);
      return {
        state: {
          buffer: buffer.slice(0, cursor) + buffer.slice(cursor + 1),
          cursor,
        },
        action: "none",
        redraw: true,
      };
    case "\x1b[D":
      return {
        state: { buffer, cursor: clampCursor(cursor - 1, buffer) },
        action: "none",
        redraw: cursor > 0,
      };
    case "\x1b[C":
      return {
        state: { buffer, cursor: clampCursor(cursor + 1, buffer) },
        action: "none",
        redraw: cursor < buffer.length,
      };
    case "\x1b[H":
    case "\x1b[1~":
      return { state: { buffer, cursor: 0 }, action: "none", redraw: cursor !== 0 };
    case "\x1b[F":
    case "\x1b[4~":
      return {
        state: { buffer, cursor: buffer.length },
        action: "none",
        redraw: cursor !== buffer.length,
      };
    case "\x1b[A":
      return { state, action: "history-prev", redraw: false };
    case "\x1b[B":
      return { state, action: "history-next", redraw: false };
    default:
      if (key.length === 1) {
        return {
          state: {
            buffer: buffer.slice(0, cursor) + key + buffer.slice(cursor),
            cursor: cursor + 1,
          },
          action: "none",
          redraw: true,
        };
      }
      return unchanged(state);
  }
}
