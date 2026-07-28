import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EjectorProps } from "@/types";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";
import * as tracking from "@/lib/tracking";
import { DeliveryError } from "@/lib/delivery/finishVideoDelivery";
import { HttpDeliveryError } from "@/lib/delivery/retry";

const checkRenderSupport = vi.fn();
const renderEjectionGif = vi.fn();
const renderEjectionVideo = vi.fn();
const downloadBlob = vi.fn();
const downloadPublicUrl = vi.fn();
const finishVideoDelivery = vi.fn();
const getStatus = vi.fn();
const complete = vi.fn();
const deliveryClient = {
  client: "delivery-client",
  getStatus,
  complete,
};
const createDeliveryClient = vi.fn(
  (_baseUrl: string, _paymentCode: string) => deliveryClient,
);
const readPendingDelivery = vi.fn();
const savePendingDelivery = vi.fn();
const clearPendingDelivery = vi.fn();

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
vi.mock("@/lib/delivery/pendingDelivery", () => ({
  readPendingDelivery: (...args: unknown[]) => readPendingDelivery(...args),
  savePendingDelivery: (...args: unknown[]) => savePendingDelivery(...args),
  clearPendingDelivery: (...args: unknown[]) => clearPendingDelivery(...args),
}));
vi.mock("@/lib/delivery/downloadPublicUrl", () => ({
  downloadPublicUrl: (...args: unknown[]) => downloadPublicUrl(...args),
}));

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
  downloadPublicUrl.mockReset();
  createDeliveryClient.mockClear();
  getStatus.mockReset();
  complete.mockReset();
  readPendingDelivery.mockReset().mockReturnValue(null);
  savePendingDelivery.mockReset();
  clearPendingDelivery.mockReset();
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useFileGeneration", () => {
  it("resumes an email-pending delivery and downloads its public URL after acceptance", async () => {
    vi.useFakeTimers();
    const pending = {
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      filename: "Red-was-ejected.mp4",
    };
    readPendingDelivery.mockReturnValue(pending);
    getStatus
      .mockResolvedValueOnce({
        deliveryId: DELIVERY_ID,
        status: "email_pending",
        downloadUrl: PUBLIC_URL,
        retryable: false,
      })
      .mockResolvedValueOnce({
        deliveryId: DELIVERY_ID,
        status: "email_accepted",
        downloadUrl: PUBLIC_URL,
        retryable: false,
      });

    renderHook(() => useFileGeneration("payment-code"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(downloadPublicUrl).toHaveBeenCalledWith(
      PUBLIC_URL,
      pending.filename,
    );
    expect(clearPendingDelivery).toHaveBeenCalledTimes(1);
    expect(renderEjectionVideo).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("completes a server-confirmed upload before polling recovery", async () => {
    readPendingDelivery.mockReturnValue({
      deliveryId: DELIVERY_ID,
      tier: "hd",
      filename: "Blue-was-ejected.mp4",
    });
    getStatus.mockResolvedValue({
      deliveryId: DELIVERY_ID,
      status: "uploaded",
      downloadUrl: PUBLIC_URL,
      retryable: true,
    });
    complete.mockResolvedValue({
      deliveryId: DELIVERY_ID,
      status: "email_accepted",
      downloadUrl: PUBLIC_URL,
      retryable: false,
    });

    renderHook(() => useFileGeneration("payment-code"));

    await waitFor(() =>
      expect(downloadPublicUrl).toHaveBeenCalledWith(
        PUBLIC_URL,
        "Blue-was-ejected.mp4",
      ),
    );
    expect(complete).toHaveBeenCalledWith(
      DELIVERY_ID,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(renderEjectionVideo).not.toHaveBeenCalled();
  });

  it("clears a pre-upload recovery record because its Blob is unavailable", async () => {
    readPendingDelivery.mockReturnValue({
      deliveryId: DELIVERY_ID,
      tier: "hd",
      filename: "Blue-was-ejected.mp4",
    });
    getStatus.mockResolvedValue({
      deliveryId: DELIVERY_ID,
      status: "created",
      downloadUrl: PUBLIC_URL,
      retryable: true,
    });

    renderHook(() => useFileGeneration("payment-code"));

    await waitFor(() =>
      expect(clearPendingDelivery).toHaveBeenCalledTimes(1),
    );
    expect(downloadPublicUrl).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("clears recovery that is absent for the current payment code", async () => {
    readPendingDelivery.mockReturnValue({
      deliveryId: DELIVERY_ID,
      tier: "hd",
      filename: "Blue-was-ejected.mp4",
    });
    getStatus.mockRejectedValue(new HttpDeliveryError(404, false));

    renderHook(() => useFileGeneration("different-payment-code"));

    await waitFor(() =>
      expect(clearPendingDelivery).toHaveBeenCalledTimes(1),
    );
    expect(downloadPublicUrl).not.toHaveBeenCalled();
  });

  it.each([
    new TypeError("offline"),
    new HttpDeliveryError(503, true),
  ])(
    "retains recovery after the delivery client exhausts a retryable %s",
    async (recoveryError) => {
      readPendingDelivery.mockReturnValue({
        deliveryId: DELIVERY_ID,
        tier: "hd",
        filename: "Blue-was-ejected.mp4",
      });
      getStatus.mockRejectedValue(recoveryError);
      const { result } = renderHook(() =>
        useFileGeneration("payment-code"),
      );

      await waitFor(() =>
        expect(result.current.error).toBe(
          "We couldn't finish delivering your video.",
        ),
      );

      expect(clearPendingDelivery).not.toHaveBeenCalled();
      expect(downloadPublicUrl).not.toHaveBeenCalled();
    },
  );

  it("clears recovery after a non-retryable expiration error", async () => {
    readPendingDelivery.mockReturnValue({
      deliveryId: DELIVERY_ID,
      tier: "hd",
      filename: "Blue-was-ejected.mp4",
    });
    getStatus.mockRejectedValue(new HttpDeliveryError(410, false));
    const { result } = renderHook(() =>
      useFileGeneration("payment-code"),
    );

    await waitFor(() =>
      expect(result.current.error).toBe(
        "We couldn't finish delivering your video.",
      ),
    );

    expect(clearPendingDelivery).toHaveBeenCalledTimes(1);
    expect(downloadPublicUrl).not.toHaveBeenCalled();
  });

  it("clears recovery after a terminal failed response", async () => {
    readPendingDelivery.mockReturnValue({
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      filename: "Red-was-ejected.mp4",
    });
    getStatus.mockResolvedValue({
      deliveryId: DELIVERY_ID,
      status: "failed",
      downloadUrl: PUBLIC_URL,
      retryable: false,
      error: { message: "Completion window expired." },
    });
    const { result } = renderHook(() =>
      useFileGeneration("payment-code"),
    );

    await waitFor(() =>
      expect(result.current.error).toBe(
        "We couldn't finish delivering your video.",
      ),
    );

    expect(clearPendingDelivery).toHaveBeenCalledTimes(1);
    expect(downloadPublicUrl).not.toHaveBeenCalled();
  });

  it("aborts at the hard recovery deadline and retains retryable recovery", async () => {
    vi.useFakeTimers();
    let pollSignal: AbortSignal | undefined;
    readPendingDelivery.mockReturnValue({
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      filename: "Red-was-ejected.mp4",
    });
    getStatus
      .mockResolvedValueOnce({
        deliveryId: DELIVERY_ID,
        status: "email_pending",
        downloadUrl: PUBLIC_URL,
        retryable: false,
      })
      .mockImplementationOnce((_deliveryId, options) => {
        pollSignal = options?.signal;
        return new Promise((_resolve, reject) => {
          pollSignal?.addEventListener(
            "abort",
            () => reject(pollSignal?.reason),
            { once: true },
          );
        });
      });
    const { result } = renderHook(() =>
      useFileGeneration("payment-code"),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(pollSignal?.aborted).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(88_999);
    });

    expect(pollSignal?.aborted).toBe(false);
    expect(clearPendingDelivery).not.toHaveBeenCalled();
    expect(downloadPublicUrl).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.phase).toBe("finishing");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(pollSignal?.aborted).toBe(true);
    expect(clearPendingDelivery).not.toHaveBeenCalled();
    expect(downloadPublicUrl).not.toHaveBeenCalled();
    expect(result.current.error).toBe(
      "We couldn't finish delivering your video.",
    );
  });

  it("aborts polling on unmount without recovery side effects", async () => {
    vi.useFakeTimers();
    let pollSignal: AbortSignal | undefined;
    readPendingDelivery.mockReturnValue({
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      filename: "Red-was-ejected.mp4",
    });
    getStatus
      .mockResolvedValueOnce({
        deliveryId: DELIVERY_ID,
        status: "email_pending",
        downloadUrl: PUBLIC_URL,
        retryable: false,
      })
      .mockImplementationOnce((_deliveryId, options) => {
        pollSignal = options?.signal;
        return new Promise((_resolve, reject) => {
          pollSignal?.addEventListener(
            "abort",
            () => reject(pollSignal?.reason),
            { once: true },
          );
        });
      });
    const { result, unmount } = renderHook(() =>
      useFileGeneration("payment-code"),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(getStatus).toHaveBeenCalledTimes(2);

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(pollSignal?.aborted).toBe(true);
    expect(clearPendingDelivery).not.toHaveBeenCalled();
    expect(downloadPublicUrl).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(tracking.trackEvent).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("ignores a stale recovery failure after a new payment-code owner starts", async () => {
    let oldSignal: AbortSignal | undefined;
    let oldReject!: (reason: unknown) => void;
    let newSignal: AbortSignal | undefined;
    readPendingDelivery.mockReturnValue({
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      filename: "Red-was-ejected.mp4",
    });
    getStatus
      .mockImplementationOnce((_deliveryId, options) => {
        oldSignal = options?.signal;
        return new Promise((_resolve, reject) => {
          oldReject = reject;
        });
      })
      .mockImplementationOnce((_deliveryId, options) => {
        newSignal = options?.signal;
        return new Promise((_resolve, reject) => {
          newSignal?.addEventListener(
            "abort",
            () => reject(newSignal?.reason),
            { once: true },
          );
        });
      });
    const { result, rerender } = renderHook(
      ({ paymentCode }) => useFileGeneration(paymentCode),
      { initialProps: { paymentCode: "old-payment-code" } },
    );
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(1));

    rerender({ paymentCode: "new-payment-code" });
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(2));

    expect(oldSignal?.aborted).toBe(true);
    expect(newSignal?.aborted).toBe(false);
    expect(createDeliveryClient.mock.calls.map(([, code]) => code)).toEqual([
      "old-payment-code",
      "new-payment-code",
    ]);

    await act(async () => {
      oldReject(new HttpDeliveryError(410, false));
      await Promise.resolve();
    });

    expect(result.current.generating).toBe("mp4");
    expect(result.current.phase).toBe("finishing");
    expect(result.current.error).toBeNull();
    expect(clearPendingDelivery).not.toHaveBeenCalled();
    expect(downloadPublicUrl).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(tracking.trackEvent).not.toHaveBeenCalled();
  });

  it("clears a recovery record when no current payment code exists", async () => {
    readPendingDelivery.mockReturnValue({
      deliveryId: DELIVERY_ID,
      tier: "hd",
      filename: "Blue-was-ejected.mp4",
    });

    renderHook(() => useFileGeneration(null));

    await waitFor(() =>
      expect(clearPendingDelivery).toHaveBeenCalledTimes(1),
    );
    expect(createDeliveryClient).not.toHaveBeenCalled();
  });

  it("gives refresh recovery sole ownership while it is active", async () => {
    let resolveStatus!: (value: {
      deliveryId: string;
      status: "email_accepted";
      downloadUrl: string;
      retryable: false;
    }) => void;
    readPendingDelivery.mockReturnValue({
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      filename: "Red-was-ejected.mp4",
    });
    getStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useFileGeneration("payment-code"),
    );
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.generate("mp4", props, "full-hd");
    });
    expect(renderEjectionVideo).not.toHaveBeenCalled();

    await act(async () => {
      resolveStatus({
        deliveryId: DELIVERY_ID,
        status: "email_accepted",
        downloadUrl: PUBLIC_URL,
        retryable: false,
      });
    });
    expect(downloadPublicUrl).toHaveBeenCalledTimes(1);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

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
    expect(savePendingDelivery).toHaveBeenCalledWith({
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      filename: "Red-was-ejected.mp4",
    });

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
    expect(clearPendingDelivery).toHaveBeenCalledTimes(1);
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
    expect(clearPendingDelivery).toHaveBeenCalled();
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
    expect(clearPendingDelivery).toHaveBeenCalledTimes(1);
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
