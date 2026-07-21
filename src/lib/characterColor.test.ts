import { describe, expect, it } from "vitest";
import { substitutePixelColor } from "./characterColor";

describe("substitutePixelColor", () => {
  const referenceRed = "#d1211d";
  const referenceDarkRed = "#8a1613";
  const target = { r: 10, g: 20, b: 30 };
  const targetDark = { r: 5, g: 10, b: 15 };

  it("substitutes the target color when the pixel matches the reference red", () => {
    // #d1211d -> r=209 g=33 b=29
    const data = new Uint8ClampedArray([209, 33, 29, 255]);
    substitutePixelColor(data, 0, referenceRed, referenceDarkRed, target, targetDark);
    expect([data[0], data[1], data[2], data[3]]).toEqual([10, 20, 30, 255]);
  });

  it("substitutes the dark target color when the pixel matches the reference dark red", () => {
    // #8a1613 -> r=138 g=22 b=19
    const data = new Uint8ClampedArray([138, 22, 19, 255]);
    substitutePixelColor(data, 0, referenceRed, referenceDarkRed, target, targetDark);
    expect([data[0], data[1], data[2], data[3]]).toEqual([5, 10, 15, 255]);
  });

  it("leaves a pixel matching neither reference color untouched", () => {
    const data = new Uint8ClampedArray([1, 2, 3, 255]);
    substitutePixelColor(data, 0, referenceRed, referenceDarkRed, target, targetDark);
    expect([data[0], data[1], data[2], data[3]]).toEqual([1, 2, 3, 255]);
  });

  it("operates at a nonzero offset within a larger buffer", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0, 209, 33, 29, 255]);
    substitutePixelColor(data, 4, referenceRed, referenceDarkRed, target, targetDark);
    expect([data[4], data[5], data[6], data[7]]).toEqual([10, 20, 30, 255]);
    expect([data[0], data[1], data[2], data[3]]).toEqual([0, 0, 0, 0]);
  });
});
