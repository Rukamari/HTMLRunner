import { describe, expect, it } from "vitest";
import {
  buildFileTree,
  getBaseName,
  getDirPath,
  type TreeNode,
} from "../fileTree";
import type { FileTab } from "../types";

function file(name: string): FileTab {
  return { id: name, name, content: "", language: "javascript" };
}

function names(nodes: TreeNode[]): string[] {
  return nodes.map((n) => `${n.isFile ? "f" : "d"}:${n.name}`);
}

describe("file tree helpers", () => {
  it("splits directory and base names", () => {
    expect(getDirPath("src/components/Button.ts")).toBe("src/components");
    expect(getDirPath("index.html")).toBe("");
    expect(getBaseName("src/components/Button.ts")).toBe("Button.ts");
    expect(getBaseName("index.html")).toBe("index.html");
  });

  it("builds nested folders with files sorted after folders", () => {
    const tree = buildFileTree([
      file("index.html"),
      file("src/a.js"),
      file("src/components/b.js"),
      file("src/z.js"),
    ]);

    expect(names(tree)).toEqual(["d:src", "f:index.html"]);

    const src = tree[0];
    if (!src) throw new Error("expected src folder");
    expect(names(src.children)).toEqual([
      "d:components",
      "f:a.js",
      "f:z.js",
    ]);
    const components = src.children[0];
    if (!components) throw new Error("expected components folder");
    expect(names(components.children)).toEqual(["f:b.js"]);
  });

  it("does not duplicate folders for shared prefixes", () => {
    const tree = buildFileTree([file("a/b/c.js"), file("a/b/d.js")]);
    expect(tree).toHaveLength(1);
    const a = tree[0];
    if (!a) throw new Error("expected a folder");
    const b = a.children[0];
    if (!b) throw new Error("expected b folder");
    expect(b.children).toHaveLength(2);
  });
});
