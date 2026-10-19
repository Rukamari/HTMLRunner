import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce, parseCommandLine } from "../utils";

describe("parseCommandLine", () => {
  it("splits on whitespace", () => {
    expect(parseCommandLine("git status --short")).toEqual([
      "git",
      "status",
      "--short",
    ]);
  });

  it("keeps quoted arguments together", () => {
    expect(parseCommandLine(`git commit -m "hello world"`)).toEqual([
      "git",
      "commit",
      "-m",
      "hello world",
    ]);
    expect(parseCommandLine("echo 'single quoted'")).toEqual([
      "echo",
      "single quoted",
    ]);
  });

  it("ignores repeated and trailing whitespace", () => {
    expect(parseCommandLine("  ls   src  ")).toEqual(["ls", "src"]);
    expect(parseCommandLine("")).toEqual([]);
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs only once after the delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes the latest arguments through", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced("first");
    debounced("second");
    vi.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledWith("second");
  });
});
