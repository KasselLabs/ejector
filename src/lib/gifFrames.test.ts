import { describe, expect, it } from "vitest";
import { isGifSource, normalizeGifDelays } from "./gifFrames";

describe("isGifSource", () => {
  it.each([
    ["https://example.com/a.gif", true],
    ["https://example.com/a.gif?x=1", true],
    ["data:image/gif;base64,xx", true],
    ["https://example.com/a.png", false],
    ["/red.png", false],
    ["data:image/png;base64,xx", false],
    ["https://example.com/a.gifxyz", false],
  ])("isGifSource(%s) -> %s", (url, expected) => {
    expect(isGifSource(url)).toBe(expected);
  });
});

describe("normalizeGifDelays", () => {
  it("replaces delays below the 20ms threshold with the 100ms legacy fallback", () => {
    expect(normalizeGifDelays([0, 10, 19])).toEqual([100, 100, 100]);
  });

  it("keeps delays at or above the threshold untouched", () => {
    expect(normalizeGifDelays([20, 50, 500])).toEqual([20, 50, 500]);
  });

  it("handles an empty list", () => {
    expect(normalizeGifDelays([])).toEqual([]);
  });
});
