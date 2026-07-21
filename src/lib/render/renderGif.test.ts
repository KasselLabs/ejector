import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMediaOnWeb = vi.fn();
vi.mock("@remotion/web-renderer", () => ({
  renderMediaOnWeb: (...args: unknown[]) => renderMediaOnWeb(...args),
}));
vi.mock("./captureFrame", () => ({
  videoFrameToRgba: vi.fn(async () => ({
    data: new Uint8ClampedArray(480 * 270 * 4),
    width: 480,
    height: 270,
  })),
}));

import { renderEjectionGif } from "./renderGif";
import { staticCharacterFrames } from "@/lib/characterImages";
import type { EjectorProps } from "@/types";

const props: EjectorProps = {
  ejectedText: "e",
  impostorText: "i",
  characterFrames: staticCharacterFrames("/red.png"),
  showWatermark: false,
};

beforeEach(() => {
  renderMediaOnWeb.mockReset();
});

describe("renderEjectionGif", () => {
  it("renders muted at 480x270 with watermark on, captures every 3rd frame, returns a gif blob", async () => {
    renderMediaOnWeb.mockImplementation(
      async (opts: { onFrame?: (f: unknown) => unknown }) => {
        for (let i = 0; i < 165; i++) {
          await opts.onFrame?.({ close: () => {}, timestamp: i });
        }
        return { getBlob: async () => new Blob([""], { type: "video/mp4" }) };
      },
    );
    const blob = await renderEjectionGif({ props });
    const call = renderMediaOnWeb.mock.calls[0][0];
    expect(call.composition.width).toBe(480);
    expect(call.composition.height).toBe(270);
    expect(call.muted).toBe(true);
    expect(call.inputProps.showWatermark).toBe(true);
    expect(blob.type).toBe("image/gif");
    expect(blob.size).toBeGreaterThan(0);
    const { videoFrameToRgba } = await import("./captureFrame");
    expect(vi.mocked(videoFrameToRgba)).toHaveBeenCalledTimes(55); // ceil(165/3)
  });
});
