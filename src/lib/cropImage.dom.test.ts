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

// Same stub as `stubImage`, but also returns every `Image` instance
// `loadImage` constructs so tests can inspect what got set on it
// (`crossOrigin`, `src`) rather than just whether the crop resolved.
function stubImageCapturing(): HTMLImageElement[] {
  const created: HTMLImageElement[] = [];
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
      created.push(img);
      return img;
    }
  }
  vi.stubGlobal("Image", MockImage);
  return created;
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

// Regression: loadImage() previously assigned `image.src = src` directly,
// with no `crossOrigin` and no CORS proxy. For real (non-data:) URLs --
// ImageUrlField's primary flow -- that taints the canvas, and
// getImageData()/toDataURL() throw a SecurityError in every real browser
// (jsdom doesn't enforce this, so the bug passed silently under the
// original tests above). Fixed by setting `crossOrigin = "anonymous"`
// before assigning `src`, and routing `src` through `getCorsUrl`.
describe("loadImage CORS handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("marks the image crossOrigin=anonymous and routes an https source through the CORS proxy", async () => {
    const created = stubImageCapturing();

    await cropImage(
      "https://example.com/hero.png",
      { x: 0, y: 0, width: 50, height: 50 },
      0,
    );

    expect(created).toHaveLength(1);
    expect(created[0].crossOrigin).toBe("anonymous");
    expect(created[0].src).toBe(
      "https://cors.kassellabs.io/https://example.com/hero.png",
    );
  });

  it("still marks crossOrigin=anonymous but leaves a data: source unchanged", async () => {
    const created = stubImageCapturing();

    await cropImage(
      "data:image/png;base64,xx",
      { x: 0, y: 0, width: 50, height: 50 },
      0,
    );

    expect(created[0].crossOrigin).toBe("anonymous");
    expect(created[0].src).toBe("data:image/png;base64,xx");
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
