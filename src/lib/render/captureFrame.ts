// Isolated so unit tests can mock the WebCodecs/canvas interaction.
export interface RgbaFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export async function videoFrameToRgba(frame: VideoFrame): Promise<RgbaFrame> {
  const width = frame.displayWidth;
  const height = frame.displayHeight;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(frame, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { data: imageData.data, width, height };
}
