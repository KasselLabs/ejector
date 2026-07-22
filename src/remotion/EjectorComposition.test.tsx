import { describe, expect, it } from "vitest";
import {
  showsBackgroundVideoAt,
  frozenBackgroundFrameSrc,
  ejectedTextAt,
  impostorScaleAt,
  characterTransformAt,
} from "./EjectorComposition";

describe("background source", () => {
  // Legacy parity: the canvas version clamped the frame sequence at index 152,
  // freezing on 153.png for the tail. The video covers everything before it.
  it("plays the video up to frame 151 and freezes on the last still from 152", () => {
    expect(showsBackgroundVideoAt(0)).toBe(true);
    expect(showsBackgroundVideoAt(151)).toBe(true);
    expect(showsBackgroundVideoAt(152)).toBe(false);
    expect(showsBackgroundVideoAt(164)).toBe(false);
  });

  it("freezes on the final extracted frame", () => {
    expect(frozenBackgroundFrameSrc()).toBe(
      "/among-us-background-images/153.png",
    );
  });
});

describe("ejectedTextAt", () => {
  it("is empty before 1.7s, full after 3.7s, partial between", () => {
    expect(ejectedTextAt("Red was ejected", 1.6)).toBe("");
    expect(ejectedTextAt("Red was ejected", 3.8)).toBe("Red was ejected");
    const partial = ejectedTextAt("Red was ejected", 2.7); // 50%
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan("Red was ejected".length);
    expect("Red was ejected".startsWith(partial)).toBe(true);
  });
});

describe("impostorScaleAt", () => {
  it("is null before 3.8s (not rendered)", () => {
    expect(impostorScaleAt(3.7)).toBeNull();
  });
  it("interpolates the pop keyframes and settles at 1", () => {
    expect(impostorScaleAt(3.8 + 0.33)).toBeCloseTo(1.2, 5);
    expect(impostorScaleAt(3.8 + 1.2)).toBeCloseTo(1, 5);
    expect(impostorScaleAt(5.4)).toBe(1);
  });
});

describe("characterTransformAt", () => {
  it("moves right at 0.28 widths/s and rotates at -1.3 rad/s", () => {
    const { xPct, rotationRad } = characterTransformAt(2);
    expect(xPct).toBeCloseTo(0.28 * 2 * 100, 5);
    expect(rotationRad).toBeCloseTo(-2.6, 5);
  });
});
