import { describe, expect, it } from "vitest";
import {
  backgroundFrameSrc,
  ejectedTextAt,
  impostorScaleAt,
  characterTransformAt,
} from "./EjectorComposition";

describe("backgroundFrameSrc", () => {
  it("maps frame 0 to 1.png and clamps at 153.png", () => {
    expect(backgroundFrameSrc(0)).toBe("/among-us-background-images/1.png");
    expect(backgroundFrameSrc(152)).toBe("/among-us-background-images/153.png");
    expect(backgroundFrameSrc(164)).toBe("/among-us-background-images/153.png");
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
