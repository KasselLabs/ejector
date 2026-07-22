import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { EjectorProps } from "@/types";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";

// Imperative mute/unmute spies exposed through the mocked Player's ref, so we
// can assert PlayerPreview drives the player's mute state via PlayerRef (not
// just the mount-time initiallyMuted prop).
const { muteMock, unmuteMock } = vi.hoisted(() => ({
  muteMock: vi.fn(),
  unmuteMock: vi.fn(),
}));

// Player needs a real browser (canvas/video); stub it to a div that captures
// the composition config it was mounted with, and exposes mute/unmute on its
// imperative ref handle.
vi.mock("@remotion/player", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    Player: forwardRef<unknown, Record<string, unknown>>((props, ref) => {
      useImperativeHandle(ref, () => ({ mute: muteMock, unmute: unmuteMock }));
      return (
        <div
          data-testid="player"
          data-duration={String(props.durationInFrames)}
          data-fps={String(props.fps)}
          data-width={String(props.compositionWidth)}
          data-height={String(props.compositionHeight)}
          data-muted={String(props.initiallyMuted)}
          data-props={JSON.stringify(props.inputProps)}
        />
      );
    }),
  };
});

import { PlayerPreview } from "./PlayerPreview";

const baseProps: EjectorProps = {
  ejectedText: "Red was not The Impostor",
  impostorText: "1 Impostor remains",
  characterFrames: staticCharacterFrames(DEFAULT_CHARACTER_URL),
  showWatermark: false,
};

beforeAll(() => {
  // jsdom does not implement media playback
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

beforeEach(() => {
  muteMock.mockClear();
  unmuteMock.mockClear();
});

describe("PlayerPreview", () => {
  it("mounts the Player with the Ejector composition config", async () => {
    render(<PlayerPreview props={baseProps} soundOn />);
    const player = await screen.findByTestId("player");
    expect(player).toHaveAttribute("data-duration", "165");
    expect(player).toHaveAttribute("data-fps", "30");
    expect(player).toHaveAttribute("data-width", "1920");
    expect(player).toHaveAttribute("data-height", "1080");
  });

  it("passes the input props through to the Player", async () => {
    render(<PlayerPreview props={baseProps} soundOn />);
    const raw = (await screen.findByTestId("player")).getAttribute("data-props");
    expect(JSON.parse(raw ?? "{}").ejectedText).toBe(
      "Red was not The Impostor",
    );
  });

  it("mutes the player initially when sound is off", async () => {
    render(<PlayerPreview props={baseProps} soundOn={false} />);
    expect(await screen.findByTestId("player")).toHaveAttribute(
      "data-muted",
      "true",
    );
  });

  it("does not mute the player when sound is on", async () => {
    render(<PlayerPreview props={baseProps} soundOn />);
    expect(await screen.findByTestId("player")).toHaveAttribute(
      "data-muted",
      "false",
    );
  });

  it("unmutes the player via its ref when sound is on", async () => {
    render(<PlayerPreview props={baseProps} soundOn />);
    await screen.findByTestId("player");
    expect(unmuteMock).toHaveBeenCalled();
    expect(muteMock).not.toHaveBeenCalled();
  });

  it("mutes the player via its ref when sound toggles off", async () => {
    const { rerender } = render(<PlayerPreview props={baseProps} soundOn />);
    await screen.findByTestId("player");
    muteMock.mockClear();
    unmuteMock.mockClear();
    rerender(<PlayerPreview props={baseProps} soundOn={false} />);
    expect(muteMock).toHaveBeenCalled();
  });

  it("renders an ambient background audio element", () => {
    const { container } = render(<PlayerPreview props={baseProps} soundOn />);
    const audio = container.querySelector("audio");
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute("src", "/background.mp3");
    // Deferred: the ambient track is only fetched on an actual play attempt.
    expect(audio).toHaveAttribute("preload", "none");
  });

});
