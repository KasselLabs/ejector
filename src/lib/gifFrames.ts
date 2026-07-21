import { decompressFrames, parseGIF } from "gifuct-js";
import { getCorsUrl } from "@/lib/corsUrl";
import type { CharacterFrames } from "@/types";

const GIF_SOURCE_PATTERN = /(^data:image\/gif)|(\.gif($|\?))/;

export function isGifSource(url: string): boolean {
  return GIF_SOURCE_PATTERN.test(url);
}

// gifuct-js reports each frame's delay in ms. GIFs that omit per-frame
// timing decode to 0 (or a tiny value); legacy's `gif-frames`-based
// pipeline used `frameInfo.delay || 10` *centiseconds* (i.e. 100ms) as the
// fallback for exactly this case. Ported here as a millisecond threshold
// so frames without meaningful timing don't flash by instantly.
const MIN_GIF_DELAY_MS = 20;
const DEFAULT_GIF_DELAY_MS = 100;

export function normalizeGifDelays(delaysMs: number[]): number[] {
  return delaysMs.map((delay) =>
    delay < MIN_GIF_DELAY_MS ? DEFAULT_GIF_DELAY_MS : delay,
  );
}

// disposalType 2 ("restore to background") means the frame's own rect
// must be cleared from the persistent canvas once it's been captured, so
// the next frame's transparent pixels don't reveal this frame's pixels
// underneath. Other disposal types (0/1/3) leave prior content in place.
const DISPOSAL_RESTORE_TO_BACKGROUND = 2;

/**
 * Fetches a GIF (through the CORS proxy), decodes it with gifuct-js, and
 * composites each frame's patch onto a persistent full-size canvas
 * (honoring frame disposal) to produce one full PNG data URL per frame.
 * Port of legacy `getCroppedImages.js`'s `getCroppedGIF`, minus the crop
 * step (see `cropImage.ts#cropCharacterSource`).
 */
export async function decodeGifToCharacterFrames(
  url: string,
): Promise<CharacterFrames> {
  const response = await fetch(getCorsUrl(url));
  const buffer = await response.arrayBuffer();
  const gif = parseGIF(buffer);
  const parsedFrames = decompressFrames(gif, true);

  const canvas = document.createElement("canvas");
  canvas.width = gif.lsd.width;
  canvas.height = gif.lsd.height;
  const context = canvas.getContext("2d");
  /* v8 ignore next 3 -- defensive: every real browser (and the
   * vitest-canvas-mock stub used in tests) returns a 2d context for a
   * freshly created canvas; unreachable under test. */
  if (!context) {
    throw new Error("2d canvas context unavailable");
  }

  const delaysMs = normalizeGifDelays(parsedFrames.map((frame) => frame.delay));

  const frames: CharacterFrames["frames"] = [];
  let elapsedMs = 0;

  for (let i = 0; i < parsedFrames.length; i++) {
    const frame = parsedFrames[i];
    const { dims } = frame;

    const patchCanvas = document.createElement("canvas");
    patchCanvas.width = dims.width;
    patchCanvas.height = dims.height;
    const patchContext = patchCanvas.getContext("2d");
    /* v8 ignore next 3 -- defensive: same as the main canvas context
     * check above; unreachable under test. */
    if (!patchContext) {
      throw new Error("2d canvas context unavailable");
    }
    const patchImageData = new ImageData(
      new Uint8ClampedArray(frame.patch),
      dims.width,
      dims.height,
    );
    patchContext.putImageData(patchImageData, 0, 0);
    context.drawImage(patchCanvas, dims.left, dims.top);

    const delayMs = delaysMs[i];
    frames.push({
      imageUrl: canvas.toDataURL("image/png"),
      startSeconds: elapsedMs / 1000,
      endSeconds: (elapsedMs + delayMs) / 1000,
    });
    elapsedMs += delayMs;

    if (frame.disposalType === DISPOSAL_RESTORE_TO_BACKGROUND) {
      context.clearRect(dims.left, dims.top, dims.width, dims.height);
    }
  }

  return { durationSeconds: elapsedMs / 1000, frames };
}
