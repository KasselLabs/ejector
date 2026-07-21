import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMediaOnWeb = vi.fn();
vi.mock("@remotion/web-renderer", () => ({
  renderMediaOnWeb: (...args: unknown[]) => renderMediaOnWeb(...args),
}));

import { renderEjectionVideo } from "./renderVideo";
import { staticCharacterFrames } from "@/lib/characterImages";
import type { EjectorProps } from "@/types";

const props: EjectorProps = {
  ejectedText: "Red was not The Impostor",
  impostorText: "1 Impostor remains",
  characterFrames: staticCharacterFrames("/red.png"),
  showWatermark: false,
};

beforeEach(() => {
  renderMediaOnWeb.mockReset();
  renderMediaOnWeb.mockResolvedValue({
    getBlob: async () => new Blob(["x"], { type: "video/mp4" }),
  });
});

describe("renderEjectionVideo", () => {
  it("renders hd at 1280x720 with watermark forced on", async () => {
    await renderEjectionVideo({ props, tier: "hd" });
    const call = renderMediaOnWeb.mock.calls[0][0];
    expect(call.composition.width).toBe(1280);
    expect(call.composition.height).toBe(720);
    expect(call.composition.fps).toBe(30);
    expect(call.composition.durationInFrames).toBe(165);
    expect(call.inputProps.showWatermark).toBe(true);
    expect(call.container).toBe("mp4");
    expect(call.videoCodec).toBe("h264");
  });

  it("renders full-hd at 1920x1080 without watermark and reports progress", async () => {
    const onProgress = vi.fn();
    renderMediaOnWeb.mockImplementation(
      async (opts: {
        onProgress?: (p: { renderedFrames: number; encodedFrames: number }) => void;
      }) => {
        opts.onProgress?.({ renderedFrames: 165, encodedFrames: 33 });
        return { getBlob: async () => new Blob(["x"], { type: "video/mp4" }) };
      },
    );
    const blob = await renderEjectionVideo({ props, tier: "full-hd", onProgress });
    const call = renderMediaOnWeb.mock.calls[0][0];
    expect(call.composition.width).toBe(1920);
    expect(call.composition.height).toBe(1080);
    expect(call.inputProps.showWatermark).toBe(false);
    expect(onProgress).toHaveBeenCalledWith(0.2);
    expect(blob.type).toBe("video/mp4");
  });
});
