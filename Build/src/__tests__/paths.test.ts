import { describe, expect, it } from "vitest";
import { resolvePath } from "../paths";

describe("resolvePath", () => {
  it("resolves simple relative paths", () => {
    expect(resolvePath("/sandbox", "./a/b.js")).toBe("/sandbox/a/b.js");
    expect(resolvePath("/sandbox/src", "util.ts")).toBe("/sandbox/src/util.ts");
  });

  it("collapses parent segments", () => {
    expect(resolvePath("/sandbox/src/lib", "../index.js")).toBe(
      "/sandbox/src/index.js",
    );
    expect(resolvePath("/sandbox/src/lib", "../../main.js")).toBe(
      "/sandbox/main.js",
    );
  });

  it("does not escape the root", () => {
    expect(resolvePath("/sandbox", "../../../etc/passwd")).toBe(
      "/etc/passwd",
    );
  });
});
