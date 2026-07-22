import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
// Audio MUST come from @remotion/media: remotion's own <Audio> renders as
// <Html5Audio>, which @remotion/web-renderer rejects outright — it throws
// while building the render scaffold, so every export fails before the first
// frame. See https://remotion.dev/docs/client-side-rendering/limitations
import { Audio, Video } from "@remotion/media";
import type { EjectorProps } from "@/types";
import { characterFrameAt } from "@/lib/characterImages";
import {
  ANIMATION_FPS,
  ANIMATION_DURATION_IN_FRAMES,
  COMPOSITION_WIDTH,
  COMPOSITION_HEIGHT,
} from "@/lib/animationConstants";

export {
  ANIMATION_FPS as COMPOSITION_FPS,
  ANIMATION_DURATION_IN_FRAMES as COMPOSITION_DURATION_IN_FRAMES,
  COMPOSITION_WIDTH,
  COMPOSITION_HEIGHT,
};

export const DEFAULT_CHARACTER_URL =
  "/among-us-red-character-color-reduced.png";

const BACKGROUND_FRAME_COUNT = 153; // legacy range(1, 154) is half-open: 1.png .. 153.png

// The background plays from the source video rather than the 153 extracted
// PNGs. Swapping an <Img> src every frame made Chrome abort the rapid
// img.decode() calls on those 1920x1080 stills ("EncodingError: The source
// image cannot be decoded."), so Remotion's delayRender() never cleared and
// every export stalled, timed out and retried forever. One <Video> decodes
// through the renderer's own media pipeline instead — and it is the same file
// the PNGs were extracted from, so the picture is unchanged.
export const BACKGROUND_VIDEO_SRC = "among-us-background.mp4";

// Legacy parity: the canvas version clamped at index 152, freezing on
// 153.png for the tail of the animation. Frames 0..151 come from the video;
// from 152 on we hold that final still (a single, never-changing src).
export function showsBackgroundVideoAt(frame: number): boolean {
  return Math.round(frame) < BACKGROUND_FRAME_COUNT - 1;
}

export function frozenBackgroundFrameSrc(): string {
  return `/among-us-background-images/${BACKGROUND_FRAME_COUNT}.png`;
}

const EJECTED_TEXT_START = 1.7;
const EJECTED_TEXT_DURATION = 2;

export function ejectedTextAt(text: string, tSeconds: number): string {
  if (tSeconds < EJECTED_TEXT_START) return "";
  if (tSeconds >= EJECTED_TEXT_START + EJECTED_TEXT_DURATION) return text;
  const pct = (tSeconds - EJECTED_TEXT_START) / EJECTED_TEXT_DURATION;
  return text.slice(0, Math.round(text.length * pct));
}

const IMPOSTOR_START = 3.8;
const IMPOSTOR_STAGES = [0, 0.33, 0.66, 1, 1.2];
const IMPOSTOR_SCALES = [0.7, 1.2, 0.8, 1.1, 1];

export function impostorScaleAt(tSeconds: number): number | null {
  const diff = tSeconds - IMPOSTOR_START;
  if (diff <= 0) return null;
  if (diff >= IMPOSTOR_STAGES[IMPOSTOR_STAGES.length - 1]) return 1;
  return interpolate(diff, IMPOSTOR_STAGES, IMPOSTOR_SCALES);
}

const CHARACTER_SPEED_X = 0.28; // composition-widths per second
const CHARACTER_ROTATION_SPEED = 1.3; // rad per second

export function characterTransformAt(tSeconds: number): {
  xPct: number;
  rotationRad: number;
} {
  return {
    xPct: CHARACTER_SPEED_X * tSeconds * 100,
    rotationRad: -CHARACTER_ROTATION_SPEED * tSeconds,
  };
}

export const EjectorComposition: React.FC<EjectorProps> = ({
  ejectedText,
  impostorText,
  characterFrames,
  showWatermark,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / ANIMATION_FPS;

  const characterFrame = characterFrameAt(characterFrames, t);
  const { xPct, rotationRad } = characterTransformAt(t);
  const impostorScale = impostorScaleAt(t);
  const baseFontSize = 0.067 * height;

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <div data-testid="bg-frame" style={{ position: "absolute", inset: 0 }}>
        {showsBackgroundVideoAt(frame) ? (
          <Video
            src={staticFile(BACKGROUND_VIDEO_SRC)}
            // The clip carries its own audio track; the ejection sound is
            // played separately below, exactly as the legacy version did.
            muted
            style={{ width: "100%", height: "100%", objectFit: "fill" }}
          />
        ) : (
          <Img
            src={staticFile(frozenBackgroundFrameSrc().slice(1))}
            style={{ width: "100%", height: "100%", objectFit: "fill" }}
          />
        )}
      </div>
      {/* Cover the tiny imperfection baked into the source frames */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "65%",
          width: "5%",
          height: "9%",
          background: "black",
        }}
      />
      <div
        data-testid="ejected-text"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: baseFontSize,
          whiteSpace: "pre-wrap",
          textAlign: "center",
        }}
      >
        {ejectedTextAt(ejectedText, t)}
      </div>
      {impostorScale !== null && (
        <div
          data-testid="impostor-text"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translateY(${0.0804 * height}px)`,
            color: "white",
            fontFamily: "Arial, sans-serif",
            fontSize: baseFontSize * impostorScale,
            textAlign: "center",
          }}
        >
          {impostorText}
        </div>
      )}
      <Img
        data-testid="character"
        src={
          characterFrame.imageUrl.startsWith("/")
            ? staticFile(characterFrame.imageUrl.slice(1))
            : characterFrame.imageUrl
        }
        style={{
          position: "absolute",
          left: `${xPct}%`,
          top: "50%",
          height: height / 4.46,
          transform: `translate(-50%, -50%) rotate(${rotationRad}rad)`,
        }}
      />
      {showWatermark && (
        <div
          data-testid="watermark"
          style={{
            position: "absolute",
            right: 0.008 * width,
            bottom: 0.018 * height,
            color: "rgba(255, 255, 255, 0.6)",
            fontFamily: "Arial, sans-serif",
            fontSize: 0.08 * height,
            lineHeight: 1,
          }}
        >
          EJECTOR.KASSELLABS.IO
        </div>
      )}
      <Audio src={staticFile("ejected.mp3")} />
    </AbsoluteFill>
  );
};
