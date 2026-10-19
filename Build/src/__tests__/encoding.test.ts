import { describe, expect, it } from "vitest";
import { byteToCharOffset } from "../encoding";

describe("byteToCharOffset", () => {
  it("maps ASCII offsets one-to-one", () => {
    expect(byteToCharOffset("hello", 0)).toBe(0);
    expect(byteToCharOffset("hello", 3)).toBe(3);
    expect(byteToCharOffset("hello", 5)).toBe(5);
  });

  it("accounts for multi-byte characters", () => {
    expect(byteToCharOffset("é", 2)).toBe(1);
    expect(byteToCharOffset("aé b", 3)).toBe(2);
  });

  it("accounts for surrogate pairs", () => {
    expect(byteToCharOffset("😀", 4)).toBe(2);
    expect(byteToCharOffset("a😀b", 5)).toBe(3);
  });

  it("clamps offsets past the end of the text", () => {
    expect(byteToCharOffset("abc", 999)).toBe(3);
    expect(byteToCharOffset("", 4)).toBe(0);
    expect(byteToCharOffset("abc", -1)).toBe(0);
  });
});
