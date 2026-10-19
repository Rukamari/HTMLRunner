import { describe, expect, it } from "vitest";
import {
  gitStatusBadgeClass,
  parsePorcelainStatus,
} from "../gitStatus";

describe("parsePorcelainStatus", () => {
  it("parses worktree-only modifications", () => {
    const entries = parsePorcelainStatus(" M src/app.js");
    expect(entries).toEqual([{ code: "M", path: "src/app.js" }]);
  });

  it("prefers the index status when both columns are set", () => {
    const entries = parsePorcelainStatus("MM src/app.js");
    expect(entries).toEqual([{ code: "M", path: "src/app.js" }]);
  });

  it("parses untracked files", () => {
    const entries = parsePorcelainStatus("?? notes.txt");
    expect(entries).toEqual([{ code: "?", path: "notes.txt" }]);
  });

  it("resolves renames to the destination path", () => {
    const entries = parsePorcelainStatus("R  old.js -> new.js");
    expect(entries).toEqual([{ code: "R", path: "new.js" }]);
  });

  it("parses multiple lines and skips blanks", () => {
    const entries = parsePorcelainStatus(
      "M  index.html\n\n?? extra.md\n",
    );
    expect(entries).toEqual([
      { code: "M", path: "index.html" },
      { code: "?", path: "extra.md" },
    ]);
  });

  it("skips lines that are too short to contain a status pair", () => {
    expect(parsePorcelainStatus("")).toEqual([]);
    expect(parsePorcelainStatus("M\n")).toEqual([]);
  });

  it("falls back to the worktree column for deleted files", () => {
    const entries = parsePorcelainStatus(" D gone.css");
    expect(entries).toEqual([{ code: "D", path: "gone.css" }]);
  });
});

describe("gitStatusBadgeClass", () => {
  it("maps known codes to badge modifiers", () => {
    expect(gitStatusBadgeClass("M")).toBe("modified");
    expect(gitStatusBadgeClass("A")).toBe("added");
    expect(gitStatusBadgeClass("D")).toBe("deleted");
    expect(gitStatusBadgeClass("R")).toBe("renamed");
  });

  it("falls back to other for unknown codes", () => {
    expect(gitStatusBadgeClass("?")).toBe("other");
    expect(gitStatusBadgeClass("U")).toBe("other");
  });
});
