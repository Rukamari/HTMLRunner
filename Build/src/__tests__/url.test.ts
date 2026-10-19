import { describe, expect, it } from "vitest";
import { normalizeInternalHref } from "../url";

describe("normalizeInternalHref", () => {
  it("strips query strings and fragments", () => {
    expect(normalizeInternalHref("page.html?name=test#section")).toBe("page.html");
  });

  it("removes leading ./ and slashes", () => {
    expect(normalizeInternalHref("./page.html")).toBe("page.html");
    expect(normalizeInternalHref("/page.html")).toBe("page.html");
  });

  it("decodes percent-encoded paths", () => {
    expect(normalizeInternalHref("my%20page.html")).toBe("my page.html");
  });

  it("leaves malformed encoding untouched", () => {
    expect(normalizeInternalHref("%E0%A4%A.html")).toBe("%E0%A4%A.html");
  });
});
