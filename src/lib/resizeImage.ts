import { getCorsUrl } from "@/lib/corsUrl";
import type { CharacterFrames } from "@/types";

export interface ResizeOptions {
  maxWidth: number;
  maxHeight: number;
  /** Optional fill drawn under the image (e.g. transparent to normalize). */
  backgroundColor?: string;
}

// Same CORS-safe image loader as cropImage.ts: crossOrigin must be set before
// src or the canvas is tainted; getCorsUrl passes data:/blob:/relative URLs
// through unchanged (the crop output is always a PNG data URL).
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = getCorsUrl(src);
  });
}

/**
 * Port of legacy `getResizedImages.js` (single-image path): downscale a PNG
 * data URL to fit within `maxWidth`×`maxHeight` preserving aspect ratio,
 * optionally filling a background colour first (transparent to normalize the
 * output), and re-encode as PNG. Keeps the final character asset small (perf).
 */
export async function resizeDataUrl(
  src: string,
  { maxWidth, maxHeight, backgroundColor }: ResizeOptions,
): Promise<string> {
  const image = await loadImage(src);
  let { width, height } = image;

  // First, try to fit the image by width.
  if (width !== maxWidth) {
    height *= maxWidth / width;
    width = maxWidth;
  }

  // If that overshoots the height, fit by height instead.
  const fitsInside = height <= maxHeight && width <= maxWidth;
  if (!fitsInside) {
    width *= maxHeight / height;
    height = maxHeight;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  /* v8 ignore next 3 -- defensive: a fresh canvas always yields a 2d context
   * in every real browser and under vitest-canvas-mock; unreachable in test. */
  if (!context) {
    throw new Error("2d canvas context unavailable");
  }

  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}

/**
 * Apply {@link resizeDataUrl} to every frame of a `CharacterFrames`, preserving
 * frame timings and total duration (port of legacy `getResizedGIF`). Static
 * single-frame results flow through the same path.
 */
export async function resizeCharacterFrames(
  frames: CharacterFrames,
  options: ResizeOptions,
): Promise<CharacterFrames> {
  const resized = await Promise.all(
    frames.frames.map(async (frame) => ({
      ...frame,
      imageUrl: await resizeDataUrl(frame.imageUrl, options),
    })),
  );
  return { ...frames, frames: resized };
}
