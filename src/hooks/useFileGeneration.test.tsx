import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EjectorProps } from "@/types";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";

const checkRenderSupport = vi.fn();
const renderEjectionGif = vi.fn();
const renderEjectionVideo = vi.fn();
const downloadBlob = vi.fn();
const trackEvent = vi.fn();

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
vi.mock("@/lib/tracking", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
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
  trackEvent.mockReset();
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
    expect(trackEvent).toHaveBeenCalledWith("download_button_initialize", {
      event_label: "gif",
      event_category: "download",
    });
    expect(trackEvent).toHaveBeenCalledWith("download_button_finish", {
      event_label: "gif",
      event_category: "download",
    });
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
});
