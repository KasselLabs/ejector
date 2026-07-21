import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import type { EjectorProps } from "@/types";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";

// Player needs a real browser (canvas/video); stub it to a div that
// captures the composition config it was mounted with.
vi.mock("@remotion/player", () => ({
  Player: (props: Record<string, unknown>) => (
    <div
      data-testid="player"
      data-duration={String(props.durationInFrames)}
      data-fps={String(props.fps)}
      data-width={String(props.compositionWidth)}
      data-height={String(props.compositionHeight)}
      data-muted={String(props.initiallyMuted)}
      data-props={JSON.stringify(props.inputProps)}
    />
  ),
}));

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

describe("PlayerPreview", () => {
  it("mounts the Player with the Ejector composition config", () => {
    render(<PlayerPreview props={baseProps} soundOn />);
    const player = screen.getByTestId("player");
    expect(player).toHaveAttribute("data-duration", "165");
    expect(player).toHaveAttribute("data-fps", "30");
    expect(player).toHaveAttribute("data-width", "1920");
    expect(player).toHaveAttribute("data-height", "1080");
  });

  it("passes the input props through to the Player", () => {
    render(<PlayerPreview props={baseProps} soundOn />);
    const raw = screen.getByTestId("player").getAttribute("data-props");
    expect(JSON.parse(raw ?? "{}").ejectedText).toBe(
      "Red was not The Impostor",
    );
  });

  it("mutes the player initially when sound is off", () => {
    render(<PlayerPreview props={baseProps} soundOn={false} />);
    expect(screen.getByTestId("player")).toHaveAttribute("data-muted", "true");
  });

  it("does not mute the player when sound is on", () => {
    render(<PlayerPreview props={baseProps} soundOn />);
    expect(screen.getByTestId("player")).toHaveAttribute("data-muted", "false");
  });

  it("renders an ambient background audio element", () => {
    const { container } = render(<PlayerPreview props={baseProps} soundOn />);
    const audio = container.querySelector("audio");
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute("src", "/background.mp3");
  });
});
