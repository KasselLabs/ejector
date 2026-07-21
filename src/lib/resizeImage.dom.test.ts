import { afterEach, describe, expect, it, vi } from "vitest";
import { resizeDataUrl, resizeCharacterFrames } from "./resizeImage";
import type { CharacterFrames } from "@/types";

// vitest-canvas-mock's drawImage() validates its argument via `instanceof
// HTMLImageElement`, so the stub returns a real <img>. jsdom never fires a
// real load event (it doesn't decode bytes), so we fire onload on src set.
// Same pattern as cropImage.dom.test.ts, but with a configurable size so both
// scaling branches (fit-by-width vs fit-by-height) are exercised.
function stubImage(width: number, height: number): HTMLImageElement[] {
  const created: HTMLImageElement[] = [];
  class MockImage {
    constructor() {
      const img = document.createElement("img");
      img.width = width;
      img.height = height;
      Object.defineProperty(img, "src", {
        configurable: true,
        set(value: string) {
          Object.defineProperty(img, "src", { configurable: true, value });
          queueMicrotask(() => img.onload?.(new Event("load")));
        },
      });
      created.push(img);
      return img;
    }
  }
  vi.stubGlobal("Image", MockImage);
  return created;
}

afterEach(() => vi.unstubAllGlobals());

describe("resizeDataUrl", () => {
  it("fits a landscape image by width and applies a background colour", async () => {
    stubImage(480, 240);
    await expect(
      resizeDataUrl("data:image/png;base64,xx", {
        maxWidth: 240,
        maxHeight: 240,
        backgroundColor: "rgba(0, 0, 0, 0)",
      }),
    ).resolves.toMatch(/^data:image\/png/);
  });

  it("fits a tall image by height when width scaling overshoots", async () => {
    // width === maxWidth (240) skips the width branch; height 480 > 240 forces
    // the fit-by-height branch.
    stubImage(240, 480);
    await expect(
      resizeDataUrl("data:image/png;base64,xx", {
        maxWidth: 240,
        maxHeight: 240,
      }),
    ).resolves.toMatch(/^data:image\/png/);
  });

  it("routes the source through the CORS-safe loader (crossOrigin set)", async () => {
    const created = stubImage(100, 100);
    await resizeDataUrl("data:image/png;base64,xx", {
      maxWidth: 240,
      maxHeight: 240,
    });
    expect(created[0].crossOrigin).toBe("anonymous");
  });
});

describe("resizeCharacterFrames", () => {
  it("resizes every frame while preserving timings and duration", async () => {
    stubImage(480, 240);
    const input: CharacterFrames = {
      durationSeconds: 0.2,
      frames: [
        { imageUrl: "data:image/png;base64,a", startSeconds: 0, endSeconds: 0.1 },
        { imageUrl: "data:image/png;base64,b", startSeconds: 0.1, endSeconds: 0.2 },
      ],
    };

    const result = await resizeCharacterFrames(input, {
      maxWidth: 240,
      maxHeight: 240,
      backgroundColor: "rgba(0, 0, 0, 0)",
    });

    expect(result.durationSeconds).toBe(0.2);
    expect(result.frames).toHaveLength(2);
    expect(result.frames[0].startSeconds).toBe(0);
    expect(result.frames[1].endSeconds).toBe(0.2);
    for (const frame of result.frames) {
      expect(frame.imageUrl).toMatch(/^data:image\/png/);
    }
  });
});
