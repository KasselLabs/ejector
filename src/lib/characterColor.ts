import tinycolor from "tinycolor2";

export interface CharacterColor {
  value: string;
  darken?: number;
}

// Exactly the legacy 12 colors (see
// `git show legacy-canvas:src/components/CharacterGenerator.js`).
export const CHARACTER_COLORS: CharacterColor[] = [
  { value: "#d1211d" },
  { value: "#1e27e2" },
  { value: "#328100", darken: 10 },
  { value: "#e052c2" },
  { value: "#e47e00" },
  { value: "#f6f157", darken: 40 },
  { value: "#3f474e", darken: 10 },
  { value: "#d7e1f1" },
  { value: "#6b2fbc", darken: 20 },
  { value: "#71491e", darken: 10 },
  { value: "#74fdd8", darken: 40 },
  { value: "#75f100" },
];

export const CHARACTER_SPRITE_URL = "/among-us-red-character-color-reduced.png";

// Byte offsets into the sprite's ImageData.data (RGBA per pixel) that land
// on a body-red pixel and a shade-red pixel respectively. Captured from the
// legacy implementation; see the same source file above.
const BODY_RED_OFFSET = 47304;
const SHADE_RED_OFFSET = 47620;

const DEFAULT_DARKEN_PERCENTAGE = 24;

function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function colorHexAtIndex(imageData: ImageData, index: number): string {
  const color = tinycolor({
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2],
  });
  return color.toHexString();
}

/**
 * Direct port of the legacy `getColorChangedImage`: loads the red
 * reference sprite, finds every pixel matching the reference body-red and
 * shade-red colors, and substitutes the target color (and its darkened
 * variant) in place. Returns a PNG data URL rather than a re-loaded
 * `Image` (the legacy return type) since callers only need the URL.
 */
export async function generateColoredCharacter(
  color: CharacterColor,
): Promise<string> {
  const canvas = document.createElement("canvas");
  const characterImage = await loadImage(CHARACTER_SPRITE_URL);
  canvas.width = characterImage.width;
  canvas.height = characterImage.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2d canvas context unavailable");
  }
  context.drawImage(characterImage, 0, 0, canvas.width, canvas.height);

  const darkenPercentage = color.darken ?? DEFAULT_DARKEN_PERCENTAGE;
  const parsedColorRGBA = tinycolor(color.value).toRgb();
  const darkParsedColorRGBA = tinycolor(color.value)
    .darken(darkenPercentage)
    .toRgb();

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  const colorRed = colorHexAtIndex(imageData, BODY_RED_OFFSET);
  const colorDarkRed = colorHexAtIndex(imageData, SHADE_RED_OFFSET);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const red = imageData.data[i];
    const green = imageData.data[i + 1];
    const blue = imageData.data[i + 2];
    const alpha = imageData.data[i + 3];
    const pixelColor = tinycolor({ r: red, g: green, b: blue, a: alpha / 255 });
    const colorHex = pixelColor.toHexString();

    if (colorHex === colorRed) {
      imageData.data[i] = parsedColorRGBA.r;
      imageData.data[i + 1] = parsedColorRGBA.g;
      imageData.data[i + 2] = parsedColorRGBA.b;
    } else if (colorHex === colorDarkRed) {
      imageData.data[i] = darkParsedColorRGBA.r;
      imageData.data[i + 1] = darkParsedColorRGBA.g;
      imageData.data[i + 2] = darkParsedColorRGBA.b;
    }
  }

  context.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}
