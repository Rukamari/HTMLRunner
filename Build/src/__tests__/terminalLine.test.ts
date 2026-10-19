import { describe, expect, it } from "vitest";
import {
  applyTerminalKey,
  EMPTY_LINE,
  type TerminalLineState,
} from "../terminalLine";

function line(buffer: string, cursor = buffer.length): TerminalLineState {
  return { buffer, cursor };
}

describe("applyTerminalKey", () => {
  it("inserts printable characters at the cursor", () => {
    const result = applyTerminalKey(line("he"), "l", false);
    expect(result.state).toEqual({ buffer: "hel", cursor: 3 });
    expect(result.redraw).toBe(true);
  });

  it("inserts in the middle of the buffer", () => {
    const result = applyTerminalKey(line("ac", 1), "b", false);
    expect(result.state).toEqual({ buffer: "abc", cursor: 2 });
  });

  it("submits on Enter and leaves the buffer intact", () => {
    const result = applyTerminalKey(line("ls -la"), "\r", false);
    expect(result.action).toBe("submit");
    expect(result.state.buffer).toBe("ls -la");
  });

  it("deletes the character before the cursor", () => {
    const result = applyTerminalKey(line("abc", 2), "\x7f", false);
    expect(result.state).toEqual({ buffer: "ac", cursor: 1 });
  });

  it("ignores backspace at the start of the line", () => {
    const state = line("abc", 0);
    const result = applyTerminalKey(state, "\x7f", false);
    expect(result.state).toBe(state);
    expect(result.redraw).toBe(false);
  });

  it("deletes at the cursor with the Delete key", () => {
    const result = applyTerminalKey(line("abc", 1), "\x1b[3~", false);
    expect(result.state).toEqual({ buffer: "ac", cursor: 1 });
  });

  it("moves the cursor left and right with arrows", () => {
    const left = applyTerminalKey(line("abc", 3), "\x1b[D", false);
    expect(left.state.cursor).toBe(2);
    const right = applyTerminalKey(left.state, "\x1b[C", false);
    expect(right.state.cursor).toBe(3);
  });

  it("clamps arrow movement to the buffer bounds", () => {
    const pastStart = applyTerminalKey(line("abc", 0), "\x1b[D", false);
    expect(pastStart.state.cursor).toBe(0);
    const pastEnd = applyTerminalKey(line("abc", 3), "\x1b[C", false);
    expect(pastEnd.state.cursor).toBe(3);
  });

  it("supports Home/End in both escape sequence flavors", () => {
    expect(applyTerminalKey(line("abc", 3), "\x1b[H", false).state.cursor).toBe(0);
    expect(applyTerminalKey(line("abc", 3), "\x1b[1~", false).state.cursor).toBe(0);
    expect(applyTerminalKey(line("abc"), "\x1b[F", false).state.cursor).toBe(3);
    expect(applyTerminalKey(line("abc"), "\x1b[4~", false).state.cursor).toBe(3);
  });

  it("Ctrl+A and Ctrl+E jump to start and end", () => {
    expect(applyTerminalKey(line("abc", 1), "a", true).state.cursor).toBe(0);
    expect(applyTerminalKey(line("abc"), "e", true).state.cursor).toBe(3);
  });

  it("Ctrl+U clears from the cursor to the start", () => {
    const result = applyTerminalKey(line("hello world", 5), "u", true);
    expect(result.state).toEqual({ buffer: " world", cursor: 0 });
    expect(result.redraw).toBe(true);
  });

  it("Ctrl+W deletes the word before the cursor", () => {
    const result = applyTerminalKey(line("git status"), "w", true);
    expect(result.state).toEqual({ buffer: "git ", cursor: 4 });
  });

  it("Ctrl+W collapses non-word runs before the cursor", () => {
    const result = applyTerminalKey(line("git   ", 6), "w", true);
    expect(result.state).toEqual({ buffer: "", cursor: 0 });
  });

  it("Ctrl+C interrupts and resets the line", () => {
    const result = applyTerminalKey(line("rm -rf"), "c", true);
    expect(result.action).toBe("interrupt");
    expect(result.state).toEqual(EMPTY_LINE);
  });

  it("Ctrl+L requests a screen clear without touching the buffer", () => {
    const result = applyTerminalKey(line("clear me"), "l", true);
    expect(result.action).toBe("clear-screen");
    expect(result.state.buffer).toBe("clear me");
  });

  it("requests history navigation on up/down arrows", () => {
    expect(applyTerminalKey(EMPTY_LINE, "\x1b[A", false).action).toBe(
      "history-prev",
    );
    expect(applyTerminalKey(EMPTY_LINE, "\x1b[B", false).action).toBe(
      "history-next",
    );
  });

  it("ignores unknown control keys and multi-byte sequences", () => {
    const state = line("abc", 1);
    expect(applyTerminalKey(state, "x", true).state).toBe(state);
    expect(applyTerminalKey(state, "\x1b[1;5C", false).state).toBe(state);
  });
});
