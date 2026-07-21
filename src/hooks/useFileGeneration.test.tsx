import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EjectorProps } from "@/types";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";
import * as tracking from "@/lib/tracking";

const checkRenderSupport = vi.fn();
const renderEjectionGif = vi.fn();
const renderEjectionVideo = vi.fn();
const downloadBlob = vi.fn();

vi.mock("@/lib/render/capability", () => ({
  checkRenderSupport: (...args: unknown[]) => checkRenderSupport(...args),
}));
vi.mock("@/lib/render/renderGif", () => ({
  renderEjectionGif: (...args: unknown[]) => renderEjectionGif(...args),
}));
vi.mock("@/lib/render/renderVideo", () => ({
  renderEjectionVideo: (...args: unknown[]) => renderEjectionVideo(...args),
}));
vi.mock("@/lib/render/download", () => ({
  downloadBlob: (...args: unknown[]) => downloadBlob(...args),
  ejectionFilename: (text: string, ext: string) =>
    `${text.replace(/\s+/g, "-")}.${ext}`,
}));

import { useFileGeneration } from "./useFileGeneration";

const props: EjectorProps = {
  ejectedText: "Red was ejected",
  impostorText: "1 Impostor remains",
  characterFrames: staticCharacterFrames(DEFAULT_CHARACTER_URL),
  showWatermark: false,
};

beforeEach(() => {
  checkRenderSupport
    .mockReset()
    .mockResolvedValue({ supported: true, reason: null });
  renderEjectionGif.mockReset().mockResolvedValue(new Blob(["x"]));
  renderEjectionVideo.mockReset().mockResolvedValue(new Blob(["x"]));
  downloadBlob.mockReset();
  // Spy on the real tracking module (no gtag in jsdom, so it would just
  // console.log) rather than vi.mock-ing it wholesale, per review feedback.
  vi.spyOn(tracking, "trackEvent").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFileGeneration", () => {
  it("renders the gif and downloads it with the ejection filename", async () => {
    const { result } = renderHook(() => useFileGeneration());

    await act(async () => {
      await result.current.generate("gif", props, null);
    });

    expect(renderEjectionGif).toHaveBeenCalledTimes(1);
    expect(renderEjectionVideo).not.toHaveBeenCalled();
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "Red-was-ejected.gif",
    );
    expect(tracking.trackEvent).toHaveBeenCalledWith(
      "download_button_initialize",
      { event_label: "gif", event_category: "download" },
    );
    expect(tracking.trackEvent).toHaveBeenCalledWith(
      "download_button_finish",
      { event_label: "gif", event_category: "download" },
    );
    expect(result.current.generating).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("renders the mp4 with the given tier and downloads it", async () => {
    const { result } = renderHook(() => useFileGeneration());

    await act(async () => {
      await result.current.generate("mp4", props, "full-hd");
    });

    expect(renderEjectionVideo).toHaveBeenCalledWith(
      expect.objectContaining({ props, tier: "full-hd" }),
    );
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "Red-was-ejected.mp4",
    );
  });

  it("never calls render when the capability check reports unsupported", async () => {
    checkRenderSupport.mockResolvedValue({
      supported: false,
      reason: "no webcodecs",
    });
    const { result } = renderHook(() => useFileGeneration());

    await act(async () => {
      await result.current.generate("gif", props, null);
    });

    expect(renderEjectionGif).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(result.current.error).toBe(
      "Video export needs a Chromium-based browser (Chrome, Edge, Brave) or recent Safari. The preview still works everywhere.",
    );
  });

  it("updates progress while rendering, then resets it once finished", async () => {
    let resolveRender!: (blob: Blob) => void;
    renderEjectionGif.mockImplementation(
      ({ onProgress }: { onProgress?: (fraction: number) => void }) => {
        onProgress?.(0.42);
        return new Promise<Blob>((resolve) => {
          resolveRender = resolve;
        });
      },
    );

    const { result } = renderHook(() => useFileGeneration());

    act(() => {
      void result.current.generate("gif", props, null);
    });

    await waitFor(() => expect(result.current.generating).toBe("gif"));
    await waitFor(() => expect(result.current.progress).toBe(0.42));

    await act(async () => {
      resolveRender(new Blob(["x"]));
    });

    expect(result.current.generating).toBeNull();
    expect(result.current.progress).toBe(0);
  });

  it("sets a generic error and still resets state when rendering throws", async () => {
    renderEjectionGif.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useFileGeneration());

    await act(async () => {
      await result.current.generate("gif", props, null);
    });

    expect(result.current.error).toBe("Something went wrong. Please try again.");
    expect(result.current.generating).toBeNull();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("clearError resets the error to null", async () => {
    checkRenderSupport.mockResolvedValue({
      supported: false,
      reason: "nope",
    });
    const { result } = renderHook(() => useFileGeneration());

    await act(async () => {
      await result.current.generate("gif", props, null);
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it("guards against a double-click racing the checkRenderSupport probe", async () => {
    // Delay the capability probe so both calls are in-flight at once before
    // either resolves — reproduces the race where runningRef.current was
    // only set to true *after* the await, letting a second click slip
    // through and start a concurrent render.
    let resolveSupport!: (value: {
      supported: boolean;
      reason: string | null;
    }) => void;
    checkRenderSupport.mockReturnValue(
      new Promise((resolve) => {
        resolveSupport = resolve;
      }),
    );

    const { result } = renderHook(() => useFileGeneration());

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.generate("gif", props, null);
      second = result.current.generate("gif", props, null);
    });

    await act(async () => {
      resolveSupport({ supported: true, reason: null });
      await Promise.all([first, second]);
    });

    expect(renderEjectionGif).toHaveBeenCalledTimes(1);
  });
});
