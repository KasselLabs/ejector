import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHARACTER_COLORS, generateColoredCharacter } from "./characterColor";

describe("generateColoredCharacter", () => {
  beforeEach(() => {
    // vitest-canvas-mock's drawImage() validates its argument via
    // `instanceof HTMLImageElement`, so the stub must return a real
    // HTMLImageElement (jsdom never fires a real `load` event since it
    // doesn't decode image bytes) rather than a plain fake object.
    class MockImage {
      constructor() {
        const img = document.createElement("img");
        // jsdom never decodes image bytes, so natural dimensions stay 0;
        // set explicit width/height so canvas sizing has something to work
        // with (matches the legacy sprite's known 125x162 dimensions).
        img.width = 125;
        img.height = 162;
        Object.defineProperty(img, "src", {
          configurable: true,
          set(value: string) {
            Object.defineProperty(img, "src", {
              configurable: true,
              value,
            });
            queueMicrotask(() => img.onload?.(new Event("load")));
          },
        });
        // Substitutes a real HTMLImageElement for `this` so instanceof
        // checks (used by vitest-canvas-mock's drawImage) pass.
        return img;
      }
    }
    vi.stubGlobal("Image", MockImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves to a data URL without throwing", async () => {
    // vitest-canvas-mock returns zeroed image data for getImageData, so
    // the actual pixel-swap output can't be meaningfully asserted here;
    // real pixel behavior is verified manually (Task 11 checkpoint).
    // This test only confirms the port's control flow (image load,
    // canvas ops, tinycolor parsing) resolves cleanly end to end.
    await expect(
      generateColoredCharacter(CHARACTER_COLORS[0]),
    ).resolves.toMatch(/^data:image\/png/);
  });
});
