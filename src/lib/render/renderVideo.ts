import { renderMediaOnWeb } from "@remotion/web-renderer";
import { EjectorComposition } from "@/remotion/EjectorComposition";
import {
  ANIMATION_DURATION_IN_FRAMES,
  ANIMATION_FPS,
} from "@/lib/animationConstants";
import type { EjectorProps, PaidTier } from "@/types";

const TIER_DIMENSIONS: Record<PaidTier, { width: number; height: number }> = {
  hd: { width: 1280, height: 720 },
  "full-hd": { width: 1920, height: 1080 },
};

export async function renderEjectionVideo({
  props,
  tier,
  onProgress,
}: {
  props: EjectorProps;
  tier: PaidTier;
  onProgress?: (fraction: number) => void;
}): Promise<Blob> {
  const { width, height } = TIER_DIMENSIONS[tier];
  const result = await renderMediaOnWeb({
    composition: {
      component: EjectorComposition,
      id: "ejector",
      width,
      height,
      fps: ANIMATION_FPS,
      durationInFrames: ANIMATION_DURATION_IN_FRAMES,
      defaultProps: props,
    },
    inputProps: { ...props, showWatermark: tier === "hd" },
    container: "mp4",
    videoCodec: "h264",
    onProgress: ({ encodedFrames }) => {
      onProgress?.(encodedFrames / ANIMATION_DURATION_IN_FRAMES);
    },
  });
  return result.getBlob();
}
