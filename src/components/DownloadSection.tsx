"use client";

import { useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";
import { CHARACTER_COLORS } from "@/lib/characterColor";
import { trackEvent } from "@/lib/tracking";
import { usePayment } from "@/contexts/PaymentProvider";
import { useFileGeneration } from "@/hooks/useFileGeneration";
import { useServerRender } from "@/hooks/useServerRender";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ErrorDialog } from "@/components/ErrorDialog";
import { PaymentDialog } from "@/components/PaymentDialog";
import type { EjectorProps, PaidTier } from "@/types";

const SERVER_RENDER_CONSENT =
  "This will send your ejection text and impostor text, plus your selected character color, to our server.";
const SERVER_RENDER_LABEL = "Render on our server";
const SERVER_RENDER_STATUS_MESSAGES = {
  connecting: "Connecting to the render server…",
  queued: "Your video is in the render queue.",
  rendering: "Rendering your video on our server…",
  delivering: "Preparing your video for download…",
  failed: "Our server couldn't finish rendering your video.",
  "connection-lost": "We couldn't check the render status. You can check this job again.",
  unavailable: "This server render is unavailable.",
};
const SERVER_RENDER_EMAIL_MESSAGES = {
  pending: "We're preparing the email with your download link.",
  sent: "We sent the download link to your payment email.",
  failed: "Email delivery failed. You can download your video here.",
};

function subscribeToLocationChange(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}

const isTestServerRender = () =>
  new URLSearchParams(window.location.search).get("testServerRender") === "1";
const serverTestDefault = () => false;

export function DownloadSection({
  props,
  stockColor = null,
}: {
  props: EjectorProps;
  stockColor?: string | null;
}) {
  const t = useT();
  const { paid, tier, code } = usePayment();
  const {
    generating,
    phase,
    progress,
    error,
    browserRenderFailed,
    canRetryDelivery,
    clearError,
    generate,
    retryDelivery,
  } = useFileGeneration(code);
  const serverRender = useServerRender(code);
  const [dialogOpen, setDialogOpen] = useState(false);
  const testServerRender = useSyncExternalStore(
    subscribeToLocationChange,
    isTestServerRender,
    serverTestDefault,
  );

  const serverState = serverRender.state;
  const serverBusy =
    serverState?.status === "connecting" ||
    serverState?.status === "queued" ||
    serverState?.status === "rendering" ||
    serverState?.status === "delivering";
  const browserBusy = generating !== null;
  const busy = browserBusy || serverBusy;
  const canCheckServerJob = serverState?.status === "connection-lost";
  const { ejectedText, impostorText } = props;
  const paidStockCharacter =
    paid && tier && code && stockColor &&
    CHARACTER_COLORS.some(({ value }) => value === stockColor);
  const validServerText =
    ejectedText.length <= 300 &&
    impostorText.length <= 300 &&
    (ejectedText.trim() !== "" || impostorText.trim() !== "");
  const serverInput =
    paidStockCharacter && validServerText
      ? { tier, color: stockColor, ejectedText, impostorText }
      : null;
  const offerBrowserFallback =
    browserRenderFailed && serverInput !== null && !busy && !canCheckServerJob;
  const offerServerRetry = serverState?.status === "failed";
  const showServerOptIn =
    serverInput && !busy && !canCheckServerJob &&
    (testServerRender || offerServerRetry);
  const errorAction = offerBrowserFallback
    ? { actionLabel: SERVER_RENDER_LABEL, onAction: handleServerRender }
    : canRetryDelivery
      ? { actionLabel: "Retry delivery", onAction: retryDelivery }
      : undefined;

  function handleServerRender() {
    if (serverInput) serverRender.start(serverInput);
  }

  function handleDownloadGif() {
    void generate("gif", props, null);
  }

  function handleDownloadVideo() {
    if (paid) {
      void generate("mp4", props, tier);
    } else {
      setDialogOpen(true);
    }
  }

  function handlePaid(unlockedTier: PaidTier) {
    setDialogOpen(false);
    void generate("mp4", props, unlockedTier);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="uppercase tracking-wide"
          disabled={browserBusy}
          onClick={handleDownloadGif}
        >
          {t("Download GIF")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="uppercase tracking-wide"
          disabled={busy}
          onClick={handleDownloadVideo}
        >
          {t("Download Video")}
        </Button>
      </div>

      {browserBusy && (
        <div className="flex w-full flex-col gap-1">
          <span className="text-xs text-white/50">
            {t(
              phase === "finishing"
                ? "Your generation is being finished."
                : "Generating",
            )}
          </span>
          <Progress value={progress * 100} />
        </div>
      )}

      {serverState && (
        <div className="flex flex-col items-center gap-2 text-center text-sm text-white/80">
          <div role="status">
            {serverState.status === "ready" ? (
              <>
                <p>{t("Your video is ready.")}</p>
                {serverState.emailStatus && (
                  <p>{t(SERVER_RENDER_EMAIL_MESSAGES[serverState.emailStatus])}</p>
                )}
              </>
            ) : (
              t(SERVER_RENDER_STATUS_MESSAGES[serverState.status])
            )}
          </div>
          {serverState.status === "ready" && (
            <Button asChild variant="outline">
              <a
                href={serverState.downloadUrl}
                download="ejection.mp4"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent("download_button_finish", {
                    event_label: "mp4",
                    event_category: "download",
                  })
                }
              >
                {t("Download")}
              </a>
            </Button>
          )}
          {canCheckServerJob && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={serverRender.retry}
            >
              {t("Retry server render connection")}
            </Button>
          )}
        </div>
      )}

      {showServerOptIn && (
        <div className="flex flex-col items-center gap-2 text-center text-sm text-white/80">
          <p>{t(SERVER_RENDER_CONSENT)}</p>
          <Button type="button" variant="outline" onClick={handleServerRender}>
            {t(offerServerRetry ? "Render again on our server" : SERVER_RENDER_LABEL)}
          </Button>
        </div>
      )}

      <PaymentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onPaid={handlePaid}
      />
      <ErrorDialog
        message={error}
        onClose={clearError}
        actionDescription={offerBrowserFallback ? SERVER_RENDER_CONSENT : undefined}
        {...errorAction}
      />
    </div>
  );
}
