import { describe, expect, it } from "vitest";
import {
  staticCharacterFrames,
  characterFrameAt,
} from "./characterImages";
import type { CharacterFrames } from "@/types";

describe("staticCharacterFrames", () => {
  it("wraps a single URL into one frame covering the whole animation", () => {
    const result = staticCharacterFrames("/red.png");
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0].imageUrl).toBe("/red.png");
    expect(result.frames[0].startSeconds).toBe(0);
    expect(result.frames[0].endSeconds).toBeGreaterThanOrEqual(5.5);
    expect(result.durationSeconds).toBeGreaterThanOrEqual(5.5);
  });
});

describe("characterFrameAt", () => {
  const gif: CharacterFrames = {
    durationSeconds: 0.3,
    frames: [
      { imageUrl: "a.png", startSeconds: 0, endSeconds: 0.1 },
      { imageUrl: "b.png", startSeconds: 0.1, endSeconds: 0.2 },
      { imageUrl: "c.png", startSeconds: 0.2, endSeconds: 0.3 },
    ],
  };

  it("returns the frame containing t", () => {
    expect(characterFrameAt(gif, 0.15).imageUrl).toBe("b.png");
  });

  it("loops past the gif duration", () => {
    expect(characterFrameAt(gif, 0.35).imageUrl).toBe("a.png");
  });

  it("falls back to the first frame on boundary misses", () => {
    expect(characterFrameAt(gif, 0.3).imageUrl).toBe("a.png");
  });

  it("static frames always resolve", () => {
    const s = staticCharacterFrames("/red.png");
    expect(characterFrameAt(s, 5.4).imageUrl).toBe("/red.png");
  });

  it("treats a non-positive duration as t=0 rather than looping", () => {
    const zeroDuration: CharacterFrames = {
      durationSeconds: 0,
      frames: [{ imageUrl: "only.png", startSeconds: 0, endSeconds: 0 }],
    };
    expect(characterFrameAt(zeroDuration, 7).imageUrl).toBe("only.png");
  });

  it("falls back to the first frame when no range contains the looped time", () => {
    const gapped: CharacterFrames = {
      durationSeconds: 1,
      // A gap between 0.1 and 1 means t=0.5 matches no frame.
      frames: [
        { imageUrl: "a.png", startSeconds: 0, endSeconds: 0.1 },
        { imageUrl: "b.png", startSeconds: 0.9, endSeconds: 1 },
      ],
    };
    expect(characterFrameAt(gapped, 0.5).imageUrl).toBe("a.png");
  });
});
