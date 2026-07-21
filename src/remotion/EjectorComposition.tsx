import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
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

export function backgroundFrameSrc(frame: number): string {
  const index = Math.min(BACKGROUND_FRAME_COUNT - 1, Math.round(frame));
  return `/among-us-background-images/${index + 1}.png`;
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
      <Img
        data-testid="bg-frame"
        src={staticFile(backgroundFrameSrc(frame).slice(1))}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "fill",
        }}
      />
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
