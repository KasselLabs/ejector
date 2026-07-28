import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EjectorProps } from "@/types";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";
import * as tracking from "@/lib/tracking";
import { DeliveryError } from "@/lib/delivery/finishVideoDelivery";

const checkRenderSupport = vi.fn();
const renderEjectionGif = vi.fn();
const renderEjectionVideo = vi.fn();
const downloadBlob = vi.fn();
const finishVideoDelivery = vi.fn();
const deliveryClient = { client: "delivery-client" };
const createDeliveryClient = vi.fn(
  (_baseUrl: string, _paymentCode: string) => deliveryClient,
);

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
vi.mock("@/lib/delivery/client", () => ({
  createDeliveryClient: (baseUrl: string, paymentCode: string) =>
    createDeliveryClient(baseUrl, paymentCode),
}));
vi.mock("@/lib/delivery/finishVideoDelivery", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/delivery/finishVideoDelivery")>();
  return {
    ...original,
    finishVideoDelivery: (...args: unknown[]) => finishVideoDelivery(...args),
  };
});

import { useFileGeneration } from "./useFileGeneration";

const DELIVERY_ID = "11111111-1111-4111-8111-111111111111";
const PUBLIC_URL = "https://downloads.test/unguessable/video.mp4";
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
  renderEjectionGif.mockReset().mockResolvedValue(new Blob(["gif"]));
  renderEjectionVideo.mockReset().mockResolvedValue(new Blob(["video"]));
  downloadBlob.mockReset();
  createDeliveryClient.mockClear();
  finishVideoDelivery.mockReset().mockResolvedValue({
    deliveryId: DELIVERY_ID,
    status: "email_accepted",
    downloadUrl: PUBLIC_URL,
    retryable: false,
  });
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(DELIVERY_ID);
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
    const { result } = renderHook(() => useFileGeneration("code"));

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
    expect(result.current.phase).toBeNull();
    expect(result.current.error).toBeNull();
    expect(finishVideoDelivery).not.toHaveBeenCalled();
  });

  it("waits for accepted email before downloading the paid MP4", async () => {
    const renderedBlob = new Blob(["exact rendered bytes"]);
    let resolveDelivery!: (value: {
      deliveryId: string;
      status: "email_accepted";
      downloadUrl: string;
      retryable: false;
    }) => void;
    renderEjectionVideo.mockResolvedValue(renderedBlob);
    finishVideoDelivery.mockReturnValue(
      new Promise((resolve) => {
        resolveDelivery = resolve;
      }),
    );
    const { result } = renderHook(() => useFileGeneration("code"));

    let generation!: Promise<void>;
    act(() => {
      generation = result.current.generate("mp4", props, "full-hd");
    });

    await waitFor(() => expect(result.current.phase).toBe("finishing"));
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(renderEjectionVideo).toHaveBeenCalledWith(
      expect.objectContaining({ props, tier: "full-hd" }),
    );
    expect(renderEjectionVideo).toHaveBeenCalledTimes(1);
    expect(createDeliveryClient).toHaveBeenCalledWith(expect.any(String), "code");
    expect(finishVideoDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        blob: renderedBlob,
        client: deliveryClient,
        deliveryId: DELIVERY_ID,
        tier: "full-hd",
      }),
    );

    await act(async () => {
      resolveDelivery({
        deliveryId: DELIVERY_ID,
        status: "email_accepted",
        downloadUrl: PUBLIC_URL,
        retryable: false,
      });
      await generation;
    });

    expect(downloadBlob).toHaveBeenCalledWith(
      renderedBlob,
      "Red-was-ejected.mp4",
    );
    expect(finishVideoDelivery.mock.invocationCallOrder[0]).toBeLessThan(
      downloadBlob.mock.invocationCallOrder[0],
    );
    expect(result.current.phase).toBeNull();
    expect(result.current.canRetryDelivery).toBe(false);
  });

  it("manual retry reuses the Blob and UUID without rerendering", async () => {
    const renderedBlob = new Blob(["exact rendered bytes"]);
    renderEjectionVideo.mockResolvedValue(renderedBlob);
    finishVideoDelivery
      .mockRejectedValueOnce(
        new DeliveryError("failed", {
          status: "failed",
          retryable: true,
        }),
      )
      .mockResolvedValueOnce({
        deliveryId: DELIVERY_ID,
        status: "email_accepted",
        downloadUrl: PUBLIC_URL,
        retryable: false,
      });
    const { result } = renderHook(() => useFileGeneration("code"));

    await act(async () => {
      await result.current.generate("mp4", props, "hd");
    });

    expect(result.current.error).toBe(
      "We couldn't finish delivering your video.",
    );
    expect(result.current.canRetryDelivery).toBe(true);
    const firstInput = finishVideoDelivery.mock.calls[0][0];

    await act(async () => {
      await result.current.retryDelivery();
    });

    expect(renderEjectionVideo).toHaveBeenCalledTimes(1);
    expect(finishVideoDelivery).toHaveBeenCalledTimes(2);
    expect(finishVideoDelivery.mock.calls[1][0].deliveryId).toBe(
      firstInput.deliveryId,
    );
    expect(finishVideoDelivery.mock.calls[1][0].blob).toBe(renderedBlob);
    expect(downloadBlob).toHaveBeenCalledWith(
      renderedBlob,
      "Red-was-ejected.mp4",
    );
    expect(result.current.error).toBeNull();
    expect(result.current.canRetryDelivery).toBe(false);
  });

  it("does not expose a retained retry through a later capability error", async () => {
    finishVideoDelivery.mockRejectedValueOnce(
      new DeliveryError("failed", {
        status: "failed",
        retryable: true,
      }),
    );
    const { result } = renderHook(() => useFileGeneration("code"));

    await act(async () => {
      await result.current.generate("mp4", props, "hd");
    });
    expect(result.current.canRetryDelivery).toBe(true);

    act(() => {
      result.current.clearError();
    });
    checkRenderSupport.mockResolvedValue({
      supported: false,
      reason: "no webcodecs",
    });
    await act(async () => {
      await result.current.generate("gif", props, null);
    });

    expect(result.current.error).toBe(
      "Video export needs a Chromium-based browser (Chrome, Edge, Brave) or recent Safari. The preview still works everywhere.",
    );
    expect(result.current.canRetryDelivery).toBe(false);
    expect(finishVideoDelivery).toHaveBeenCalledTimes(1);
  });

  it("does not start paid delivery when rendering resolves after unmount", async () => {
    let resolveRender!: (blob: Blob) => void;
    renderEjectionVideo.mockReturnValue(
      new Promise((resolve) => {
        resolveRender = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useFileGeneration("code"));

    let generation!: Promise<void>;
    act(() => {
      generation = result.current.generate("mp4", props, "full-hd");
    });
    await waitFor(() =>
      expect(renderEjectionVideo).toHaveBeenCalledTimes(1),
    );
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      resolveRender(new Blob(["late video"]));
      await generation;
    });

    expect(finishVideoDelivery).not.toHaveBeenCalled();
    expect(globalThis.crypto.randomUUID).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("does not download or play success audio when delivery settles after unmount", async () => {
    let resolveDelivery!: (value: {
      deliveryId: string;
      status: "email_accepted";
      downloadUrl: string;
      retryable: false;
    }) => void;
    finishVideoDelivery.mockReturnValue(
      new Promise((resolve) => {
        resolveDelivery = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useFileGeneration("code"));

    let generation!: Promise<void>;
    act(() => {
      generation = result.current.generate("mp4", props, "hd");
    });
    await waitFor(() => expect(finishVideoDelivery).toHaveBeenCalledTimes(1));
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      resolveDelivery({
        deliveryId: DELIVERY_ID,
        status: "email_accepted",
        downloadUrl: PUBLIC_URL,
        retryable: false,
      });
      await generation;
    });

    expect(renderEjectionVideo).toHaveBeenCalledTimes(1);
    expect(finishVideoDelivery).toHaveBeenCalledTimes(1);
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("exposes rendering then finishing phases for a paid MP4", async () => {
    let resolveRender!: (blob: Blob) => void;
    let resolveDelivery!: (value: {
      deliveryId: string;
      status: "email_accepted";
      downloadUrl: string;
      retryable: false;
    }) => void;
    renderEjectionVideo.mockReturnValue(
      new Promise((resolve) => {
        resolveRender = resolve;
      }),
    );
    finishVideoDelivery.mockReturnValue(
      new Promise((resolve) => {
        resolveDelivery = resolve;
      }),
    );
    const { result } = renderHook(() => useFileGeneration("code"));

    let generation!: Promise<void>;
    act(() => {
      generation = result.current.generate("mp4", props, "hd");
    });
    await waitFor(() => expect(result.current.phase).toBe("rendering"));

    await act(async () => {
      resolveRender(new Blob(["video"]));
    });
    await waitFor(() => expect(result.current.phase).toBe("finishing"));

    await act(async () => {
      resolveDelivery({
        deliveryId: DELIVERY_ID,
        status: "email_accepted",
        downloadUrl: PUBLIC_URL,
        retryable: false,
      });
      await generation;
    });
    expect(result.current.phase).toBeNull();
  });

  it("clears retained delivery data after a non-retryable failure", async () => {
    finishVideoDelivery.mockRejectedValue(
      new DeliveryError("expired", {
        status: "failed",
        retryable: false,
      }),
    );
    const { result } = renderHook(() => useFileGeneration("code"));

    await act(async () => {
      await result.current.generate("mp4", props, "hd");
    });
    await act(async () => {
      await result.current.retryDelivery();
    });

    expect(result.current.error).toBe(
      "We couldn't finish delivering your video.",
    );
    expect(result.current.canRetryDelivery).toBe(false);
    expect(finishVideoDelivery).toHaveBeenCalledTimes(1);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("guards against overlapping manual delivery retries", async () => {
    finishVideoDelivery
      .mockRejectedValueOnce(
        new DeliveryError("failed", {
          status: "failed",
          retryable: true,
        }),
      )
      .mockResolvedValue({
        deliveryId: DELIVERY_ID,
        status: "email_accepted",
        downloadUrl: PUBLIC_URL,
        retryable: false,
      });
    const { result } = renderHook(() => useFileGeneration("code"));

    await act(async () => {
      await result.current.generate("mp4", props, "hd");
    });
    await act(async () => {
      await Promise.all([
        result.current.retryDelivery(),
        result.current.retryDelivery(),
      ]);
    });

    expect(finishVideoDelivery).toHaveBeenCalledTimes(2);
    expect(renderEjectionVideo).toHaveBeenCalledTimes(1);
  });

  it("never calls render when the capability check reports unsupported", async () => {
    checkRenderSupport.mockResolvedValue({
      supported: false,
      reason: "no webcodecs",
    });
    const { result } = renderHook(() => useFileGeneration("code"));

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

    const { result } = renderHook(() => useFileGeneration("code"));

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
    const { result } = renderHook(() => useFileGeneration("code"));

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
    const { result } = renderHook(() => useFileGeneration("code"));

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

    const { result } = renderHook(() => useFileGeneration("code"));

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
