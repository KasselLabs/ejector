import { renderMediaOnWeb } from "@remotion/web-renderer";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { EjectorComposition } from "@/remotion/EjectorComposition";
import {
  ANIMATION_DURATION_IN_FRAMES,
  ANIMATION_FPS,
} from "@/lib/animationConstants";
import type { EjectorProps } from "@/types";
import { videoFrameToRgba, type RgbaFrame } from "./captureFrame";

const GIF_WIDTH = 480;
const GIF_HEIGHT = 270;
const GIF_FRAME_STEP = 3; // 30fps -> 10fps
const GIF_FRAME_DELAY_MS = 100;

export async function renderEjectionGif({
  props,
  onProgress,
}: {
  props: EjectorProps;
  onProgress?: (fraction: number) => void;
}): Promise<Blob> {
  const captured: RgbaFrame[] = [];
  let frameIndex = 0;

  await renderMediaOnWeb({
    composition: {
      component: EjectorComposition,
      id: "ejector-gif",
      width: GIF_WIDTH,
      height: GIF_HEIGHT,
      fps: ANIMATION_FPS,
      durationInFrames: ANIMATION_DURATION_IN_FRAMES,
      defaultProps: props,
    },
    inputProps: { ...props, showWatermark: true },
    container: "mp4",
    videoCodec: "h264",
    muted: true,
    onFrame: async (frame: VideoFrame) => {
      if (frameIndex % GIF_FRAME_STEP === 0) {
        captured.push(await videoFrameToRgba(frame));
      }
      frameIndex += 1;
      onProgress?.((frameIndex / ANIMATION_DURATION_IN_FRAMES) * 0.7);
      return frame;
    },
  });

  const gif = GIFEncoder();
  captured.forEach((frame, i) => {
    const palette = quantize(frame.data, 256);
    const index = applyPalette(frame.data, palette);
    gif.writeFrame(index, frame.width, frame.height, {
      palette,
      delay: GIF_FRAME_DELAY_MS,
    });
    onProgress?.(0.7 + ((i + 1) / captured.length) * 0.3);
  });
  gif.finish();

  return new Blob([gif.bytes()], { type: "image/gif" });
}
