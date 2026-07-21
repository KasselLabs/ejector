import type { CharacterFrame, CharacterFrames } from "@/types";
import { ANIMATION_SECONDS } from "./animationConstants";

export function staticCharacterFrames(imageUrl: string): CharacterFrames {
  return {
    durationSeconds: ANIMATION_SECONDS,
    frames: [
      { imageUrl, startSeconds: 0, endSeconds: ANIMATION_SECONDS },
    ],
  };
}

export function characterFrameAt(
  frames: CharacterFrames,
  tSeconds: number,
): CharacterFrame {
  const looped =
    frames.durationSeconds > 0 ? tSeconds % frames.durationSeconds : 0;
  const found = frames.frames.find(
    (f) => looped >= f.startSeconds && looped < f.endSeconds,
  );
  return found ?? frames.frames[0];
}
