import { staticCharacterFrames } from "@/lib/characterImages";
import { getCorsUrl } from "@/lib/corsUrl";
import { decodeGifToCharacterFrames, isGifSource } from "@/lib/gifFrames";
import type { CharacterFrames } from "@/types";

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

// Loading through the CORS proxy without `crossOrigin` set taints the
// canvas: `getImageData`/`toDataURL` then throw a SecurityError in every
// real browser (jsdom doesn't enforce this, so it was easy to miss under
// test). `crossOrigin` must be set *before* `src` is assigned -- setting
// it after the browser has already started the fetch has no effect. Port
// of legacy `getCORSImage.js`. `getCorsUrl` passes data:/blob:/relative
// URLs through unchanged, so this is also safe for the UploadArea
// data-URL path and the GIF-frame data URLs from `decodeGifToCharacterFrames`.
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
 * Port of legacy `getCroppedImages.js`'s static-image path: rotates the
 * source image around its center on an oversized "safe area" canvas (so
 * rotation never clips corners), then re-crops that rotated canvas down to
 * `cropArea`.
 */
export async function cropImage(
  srcDataUrl: string,
  cropArea: CropArea,
  rotation = 0,
): Promise<string> {
  const image = await loadImage(srcDataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2d canvas context unavailable");
  }

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  // Size the canvas to fit the image after rotation, without clipping.
  canvas.width = safeArea;
  canvas.height = safeArea;

  context.translate(safeArea / 2, safeArea / 2);
  context.rotate(getRadianAngle(rotation));
  context.translate(-safeArea / 2, -safeArea / 2);

  context.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5,
  );
  const rotatedImageData = context.getImageData(0, 0, safeArea, safeArea);

  // Resizing the canvas clears its context, so this both "moves" to the
  // final crop dimensions and wipes the rotated draw above.
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;

  context.putImageData(
    rotatedImageData,
    0 - safeArea / 2 + image.width * 0.5 - cropArea.x,
    0 - safeArea / 2 + image.height * 0.5 - cropArea.y,
  );

  return canvas.toDataURL("image/png");
}

/**
 * Crops a character source image, GIF or static, into `CharacterFrames`.
 * GIFs are decoded to one full frame per GIF frame first (preserving
 * their timings), then each frame is cropped independently; static images
 * become a single-frame result via `staticCharacterFrames`.
 */
export async function cropCharacterSource(
  src: string,
  cropArea: CropArea,
  rotation = 0,
): Promise<CharacterFrames> {
  if (isGifSource(src)) {
    const decoded = await decodeGifToCharacterFrames(src);
    const frames = await Promise.all(
      decoded.frames.map(async (frame) => ({
        ...frame,
        imageUrl: await cropImage(frame.imageUrl, cropArea, rotation),
      })),
    );
    return { durationSeconds: decoded.durationSeconds, frames };
  }

  const croppedImageUrl = await cropImage(src, cropArea, rotation);
  return staticCharacterFrames(croppedImageUrl);
}
