import { useCallback, useRef, useState } from "react";
import { checkRenderSupport } from "@/lib/render/capability";
import { renderEjectionGif } from "@/lib/render/renderGif";
import { renderEjectionVideo } from "@/lib/render/renderVideo";
import { downloadBlob, ejectionFilename } from "@/lib/render/download";
import { trackEvent } from "@/lib/tracking";
import { useT } from "@/lib/i18n";
import type { EjectorProps, PaidTier } from "@/types";

export type GenerationKind = "gif" | "mp4";

export interface UseFileGeneration {
  generating: GenerationKind | null;
  progress: number;
  error: string | null;
  clearError: () => void;
  generate: (
    kind: GenerationKind,
    props: EjectorProps,
    tier: PaidTier | null,
  ) => Promise<void>;
}

// jsdom implements HTMLMediaElement but not real playback; tests stub
// HTMLMediaElement.prototype.play, which this picks up since Audio()
// instances are HTMLAudioElement (a HTMLMediaElement subclass).
function playSound(src: string): void {
  const audio = new Audio(src);
  void audio.play().catch(() => {});
}

export function useFileGeneration(): UseFileGeneration {
  const t = useT();
  const [generating, setGenerating] = useState<GenerationKind | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const generate = useCallback(
    async (
      kind: GenerationKind,
      props: EjectorProps,
      tier: PaidTier | null,
    ) => {
      if (runningRef.current) return;

      const support = await checkRenderSupport();
      if (!support.supported) {
        setError(
          t(
            "Video export needs a Chromium-based browser (Chrome, Edge, Brave) or recent Safari. The preview still works everywhere.",
          ),
        );
        return;
      }

      runningRef.current = true;
      setError(null);
      setGenerating(kind);
      setProgress(0);
      playSound("/task_Inprogress.mp3");
      trackEvent("download_button_initialize", {
        event_label: kind,
        event_category: "download",
      });

      try {
        const blob =
          kind === "gif"
            ? await renderEjectionGif({ props, onProgress: setProgress })
            : await renderEjectionVideo({
                props,
                tier: tier ?? "hd",
                onProgress: setProgress,
              });

        downloadBlob(blob, ejectionFilename(props.ejectedText, kind));
        trackEvent("download_button_finish", {
          event_label: kind,
          event_category: "download",
        });
        playSound("/task_Complete.mp3");
      } catch {
        setError(t("Something went wrong. Please try again."));
      } finally {
        runningRef.current = false;
        setGenerating(null);
        setProgress(0);
      }
    },
    [t],
  );

  return { generating, progress, error, clearError, generate };
}
