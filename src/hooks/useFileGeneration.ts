import { useCallback, useEffect, useRef, useState } from "react";
import { checkRenderSupport } from "@/lib/render/capability";
import { renderEjectionGif } from "@/lib/render/renderGif";
import { renderEjectionVideo } from "@/lib/render/renderVideo";
import { downloadBlob, ejectionFilename } from "@/lib/render/download";
import { trackEvent } from "@/lib/tracking";
import { useT } from "@/lib/i18n";
import { paymentApiUrl } from "@/lib/config";
import { createDeliveryClient } from "@/lib/delivery/client";
import {
  DeliveryError,
  finishVideoDelivery,
} from "@/lib/delivery/finishVideoDelivery";
import { isRetryableDeliveryError } from "@/lib/delivery/retry";
import type { EjectorProps, PaidTier } from "@/types";

export type GenerationKind = "gif" | "mp4";
export type GenerationPhase = "rendering" | "finishing" | null;

export interface UseFileGeneration {
  generating: GenerationKind | null;
  phase: GenerationPhase;
  progress: number;
  error: string | null;
  canRetryDelivery: boolean;
  clearError: () => void;
  generate: (
    kind: GenerationKind,
    props: EjectorProps,
    tier: PaidTier | null,
  ) => Promise<void>;
  retryDelivery: () => Promise<void>;
}

interface PendingDelivery {
  blob: Blob;
  filename: string;
  tier: PaidTier;
  paymentCode: string;
  deliveryId: string;
}

// jsdom implements HTMLMediaElement but not real playback; tests stub
// HTMLMediaElement.prototype.play, which this picks up since Audio()
// instances are HTMLAudioElement (a HTMLMediaElement subclass).
function playSound(src: string): void {
  const audio = new Audio(src);
  void audio.play().catch(() => {});
}

function canRetry(error: unknown): boolean {
  return (
    (error instanceof DeliveryError && error.retryable) ||
    isRetryableDeliveryError(error)
  );
}

export function useFileGeneration(
  paymentCode: string | null = null,
): UseFileGeneration {
  const t = useT();
  const [generating, setGenerating] = useState<GenerationKind | null>(null);
  const [phase, setPhase] = useState<GenerationPhase>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canRetryDelivery, setCanRetryDelivery] = useState(false);
  const runningRef = useRef(false);
  const pendingDeliveryRef = useRef<PendingDelivery | null>(null);
  const mountedRef = useRef(true);
  const operationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
    };
  }, []);

  const isActiveOperation = useCallback(
    (operationId: number) =>
      mountedRef.current && operationRef.current === operationId,
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
    setCanRetryDelivery(false);
  }, []);

  const deliver = useCallback(
    async (pending: PendingDelivery, operationId: number) => {
      if (!isActiveOperation(operationId)) return;
      try {
        await finishVideoDelivery({
          client: createDeliveryClient(paymentApiUrl, pending.paymentCode),
          blob: pending.blob,
          deliveryId: pending.deliveryId,
          tier: pending.tier,
        });
        if (!isActiveOperation(operationId)) return;
        pendingDeliveryRef.current = null;
        setCanRetryDelivery(false);
        downloadBlob(pending.blob, pending.filename);
        trackEvent("download_button_finish", {
          event_label: "mp4",
          event_category: "download",
        });
        playSound("/task_Complete.mp3");
      } catch (deliveryError) {
        if (!isActiveOperation(operationId)) return;
        const retryable = canRetry(deliveryError);
        if (!retryable) {
          pendingDeliveryRef.current = null;
        }
        setCanRetryDelivery(retryable);
        setError(t("We couldn't finish delivering your video."));
      }
    },
    [isActiveOperation, t],
  );

  const generate = useCallback(
    async (
      kind: GenerationKind,
      props: EjectorProps,
      tier: PaidTier | null,
    ) => {
      // Set the guard synchronously, before the first await, so a second
      // click that lands while checkRenderSupport() is still pending can
      // never slip through and start a concurrent render.
      if (runningRef.current) return;
      runningRef.current = true;
      const operationId = ++operationRef.current;
      setError(null);
      setCanRetryDelivery(false);

      try {
        const support = await checkRenderSupport();
        if (!isActiveOperation(operationId)) return;
        if (!support.supported) {
          setError(
            t(
              "Video export needs a Chromium-based browser (Chrome, Edge, Brave) or recent Safari. The preview still works everywhere.",
            ),
          );
          return;
        }

        setGenerating(kind);
        setPhase("rendering");
        setProgress(0);
        playSound("/task_Inprogress.mp3");
        trackEvent("download_button_initialize", {
          event_label: kind,
          event_category: "download",
        });

        const blob =
          kind === "gif"
            ? await renderEjectionGif({
                props,
                onProgress: (value) => {
                  if (isActiveOperation(operationId)) setProgress(value);
                },
              })
            : await renderEjectionVideo({
                props,
                tier: tier ?? "hd",
                onProgress: (value) => {
                  if (isActiveOperation(operationId)) setProgress(value);
                },
              });

        if (!isActiveOperation(operationId)) return;
        const filename = ejectionFilename(props.ejectedText, kind);
        if (kind === "mp4") {
          if (!tier || !paymentCode) {
            throw new DeliveryError("Missing paid delivery entitlement.", {
              status: "failed",
              retryable: false,
            });
          }
          const pending = {
            blob,
            filename,
            tier,
            paymentCode,
            deliveryId: crypto.randomUUID(),
          };
          pendingDeliveryRef.current = pending;
          setPhase("finishing");
          await deliver(pending, operationId);
          return;
        }

        downloadBlob(blob, filename);
        trackEvent("download_button_finish", {
          event_label: kind,
          event_category: "download",
        });
        playSound("/task_Complete.mp3");
      } catch (generationError) {
        if (!isActiveOperation(operationId)) return;
        if (generationError instanceof DeliveryError) {
          pendingDeliveryRef.current = null;
          setCanRetryDelivery(false);
          setError(t("We couldn't finish delivering your video."));
        } else {
          setCanRetryDelivery(false);
          setError(t("Something went wrong. Please try again."));
        }
      } finally {
        if (isActiveOperation(operationId)) {
          runningRef.current = false;
          setGenerating(null);
          setPhase(null);
          setProgress(0);
        }
      }
    },
    [deliver, isActiveOperation, paymentCode, t],
  );

  const retryDelivery = useCallback(async () => {
    const pending = pendingDeliveryRef.current;
    if (!pending || runningRef.current) return;
    runningRef.current = true;
    const operationId = ++operationRef.current;
    setError(null);
    setCanRetryDelivery(false);
    setGenerating("mp4");
    setPhase("finishing");
    try {
      await deliver(pending, operationId);
    } finally {
      if (isActiveOperation(operationId)) {
        runningRef.current = false;
        setGenerating(null);
        setPhase(null);
        setProgress(0);
      }
    }
  }, [deliver, isActiveOperation]);

  return {
    generating,
    phase,
    progress,
    error,
    canRetryDelivery,
    clearError,
    generate,
    retryDelivery,
  };
}
