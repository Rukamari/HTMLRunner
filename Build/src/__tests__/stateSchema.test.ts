import { describe, expect, it } from "vitest";
import { parseStateSnapshot } from "../stateSchema";

describe("parseStateSnapshot", () => {
  it("rejects non-object input", () => {
    expect(parseStateSnapshot(null)).toEqual({});
    expect(parseStateSnapshot([])).toEqual({});
    expect(parseStateSnapshot("nope")).toEqual({});
  });

  it("keeps valid fields and drops invalid ones", () => {
    const parsed = parseStateSnapshot({
      files: [
        { id: "a.js", name: "app/a.js", content: "1", language: "javascript" },
        { id: "broken", name: "broken.js" },
      ],
      activeFile: "a.js",
      activeOutput: "console",
      splitSizes: [30, 70],
      darkMode: true,
      autoRun: false,
      logFilters: ["error", "verbose"],
    });

    expect(parsed.files).toEqual([
      { id: "a.js", name: "app/a.js", content: "1", language: "javascript" },
    ]);
    expect(parsed.activeFile).toBe("a.js");
    expect(parsed.activeOutput).toBe("console");
    expect(parsed.splitSizes).toEqual([30, 70]);
    expect(parsed.darkMode).toBe(true);
    expect(parsed.autoRun).toBe(false);
    expect(parsed.logFilters).toEqual(["error"]);
  });

  it("derives a language when persisted data lacks one", () => {
    const parsed = parseStateSnapshot({
      files: [{ id: "styles.css", name: "styles.css", content: "" }],
    });
    expect(parsed.files?.[0]?.language).toBe("css");
  });

  it("rejects unknown output, bad split sizes and empty filter lists", () => {
    expect(parseStateSnapshot({ activeOutput: "debug" }).activeOutput).toBe(
      undefined,
    );
    expect(parseStateSnapshot({ splitSizes: [50] }).splitSizes).toBeUndefined();
    expect(
      parseStateSnapshot({ splitSizes: [50, Number.NaN] }).splitSizes,
    ).toBeUndefined();
    expect(
      parseStateSnapshot({ logFilters: ["nope"] }).logFilters,
    ).toBeUndefined();
    expect(parseStateSnapshot({ logFilters: [] }).logFilters).toEqual([]);
  });
});
