import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterGenerator } from "./CharacterGenerator";
import { CHARACTER_COLORS } from "@/lib/characterColor";

// Canvas pixel ops in characterColor.ts can't run under jsdom
// (vitest-canvas-mock returns zeroed pixel data), so the component test
// mocks the module boundary instead of exercising real pixel-swap logic.
// generateColoredCharacter itself is covered by characterColor.dom.test.ts.
vi.mock("@/lib/characterColor", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/characterColor")>(
      "@/lib/characterColor",
    );
  return {
    ...actual,
    generateColoredCharacter: vi.fn(async () => "data:image/png;base64,mocked"),
  };
});

describe("CharacterGenerator", () => {
  it("renders one swatch per character color, labelled with its hex value", () => {
    render(<CharacterGenerator onChange={vi.fn()} />);
    for (const color of CHARACTER_COLORS) {
      expect(screen.getByLabelText(color.value)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(
      CHARACTER_COLORS.length,
    );
  });

  it("does not call onChange on mount (red is selected by default)", () => {
    const onChange = vi.fn();
    render(<CharacterGenerator onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("marks the default red swatch as selected", () => {
    render(<CharacterGenerator onChange={vi.fn()} />);
    expect(screen.getByLabelText("#d1211d").className).toMatch(/ring-white/);
  });

  it("calls onChange with a single-frame CharacterFrames when a swatch is clicked", async () => {
    const onChange = vi.fn();
    render(<CharacterGenerator onChange={onChange} />);

    await userEvent.click(screen.getByLabelText("#1e27e2"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const frames = onChange.mock.calls[0][0];
    expect(frames.frames).toHaveLength(1);
    expect(frames.frames[0].imageUrl).toBe("data:image/png;base64,mocked");
  });

  it("moves the selection ring to the clicked swatch", async () => {
    render(<CharacterGenerator onChange={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("#1e27e2"));

    expect(screen.getByLabelText("#1e27e2").className).toMatch(
      /ring-white/,
    );
    expect(screen.getByLabelText("#d1211d").className).not.toMatch(
      /ring-white/,
    );
  });
});
