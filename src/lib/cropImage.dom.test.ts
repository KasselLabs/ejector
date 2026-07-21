import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const decodeGifToCharacterFrames = vi.fn();
// decodeGifToCharacterFrames does real GIF decompression + canvas
// compositing; it's a canvas-touching leaf module (same sanction as Task
// 8's captureFrame / Task 9's characterColor), so it's mocked here to test
// cropCharacterSource's *wiring* to it, not GIF decoding itself (covered
// by gifFrames.test.ts's pure-logic pieces).
vi.mock("@/lib/gifFrames", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gifFrames")>();
  return {
    ...actual,
    decodeGifToCharacterFrames: (...args: [string]) =>
      decodeGifToCharacterFrames(...args),
  };
});

import { cropCharacterSource, cropImage } from "./cropImage";
import type { CharacterFrames } from "@/types";

// vitest-canvas-mock's drawImage() validates its argument via `instanceof
// HTMLImageElement`, so the stub must return a real HTMLImageElement
// (jsdom never fires a real `load` event since it doesn't decode image
// bytes) rather than a plain fake object. Same pattern as
// characterColor.dom.test.ts.
function stubImage() {
  class MockImage {
    constructor() {
      const img = document.createElement("img");
      img.width = 100;
      img.height = 100;
      Object.defineProperty(img, "src", {
        configurable: true,
        set(value: string) {
          Object.defineProperty(img, "src", { configurable: true, value });
          queueMicrotask(() => img.onload?.(new Event("load")));
        },
      });
      return img;
    }
  }
  vi.stubGlobal("Image", MockImage);
}

describe("cropImage", () => {
  beforeEach(stubImage);
  afterEach(() => vi.unstubAllGlobals());

  it("resolves to a cropped PNG data URL", async () => {
    await expect(
      cropImage(
        "data:image/png;base64,xx",
        { x: 0, y: 0, width: 50, height: 50 },
        0,
      ),
    ).resolves.toMatch(/^data:image\/png/);
  });

  it("supports rotation without throwing", async () => {
    await expect(
      cropImage(
        "data:image/png;base64,xx",
        { x: 0, y: 0, width: 50, height: 50 },
        45,
      ),
    ).resolves.toMatch(/^data:image\/png/);
  });
});

describe("cropCharacterSource", () => {
  beforeEach(stubImage);
  afterEach(() => {
    vi.unstubAllGlobals();
    decodeGifToCharacterFrames.mockReset();
  });

  it("crops a static image into a single-frame CharacterFrames", async () => {
    const result = await cropCharacterSource(
      "data:image/png;base64,xx",
      { x: 0, y: 0, width: 50, height: 50 },
      0,
    );
    expect(decodeGifToCharacterFrames).not.toHaveBeenCalled();
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0].imageUrl).toMatch(/^data:image\/png/);
  });

  it("decodes and crops every GIF frame, preserving frame timings", async () => {
    const decoded: CharacterFrames = {
      durationSeconds: 0.2,
      frames: [
        {
          imageUrl: "data:image/png;base64,frame1",
          startSeconds: 0,
          endSeconds: 0.1,
        },
        {
          imageUrl: "data:image/png;base64,frame2",
          startSeconds: 0.1,
          endSeconds: 0.2,
        },
      ],
    };
    decodeGifToCharacterFrames.mockResolvedValue(decoded);

    const result = await cropCharacterSource(
      "https://example.com/a.gif",
      { x: 0, y: 0, width: 50, height: 50 },
      0,
    );

    expect(decodeGifToCharacterFrames).toHaveBeenCalledWith(
      "https://example.com/a.gif",
    );
    expect(result.durationSeconds).toBe(0.2);
    expect(result.frames).toHaveLength(2);
    expect(result.frames[0].startSeconds).toBe(0);
    expect(result.frames[0].endSeconds).toBe(0.1);
    expect(result.frames[1].startSeconds).toBe(0.1);
    expect(result.frames[1].endSeconds).toBe(0.2);
    for (const frame of result.frames) {
      expect(frame.imageUrl).toMatch(/^data:image\/png/);
    }
  });
});
