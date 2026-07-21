"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { usePayment } from "@/contexts/PaymentProvider";
import { useFileGeneration } from "@/hooks/useFileGeneration";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ErrorDialog } from "@/components/ErrorDialog";
import { PaymentDialog } from "@/components/PaymentDialog";
import type { EjectorProps, PaidTier } from "@/types";

export function DownloadSection({ props }: { props: EjectorProps }) {
  const t = useT();
  const { paid, tier } = usePayment();
  const { generating, progress, error, clearError, generate } =
    useFileGeneration();
  const [dialogOpen, setDialogOpen] = useState(false);

  const busy = generating !== null;

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
          disabled={busy}
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

      {busy && (
        <div className="flex w-full flex-col gap-1">
          <span className="text-xs text-white/50">{t("Generating")}</span>
          <Progress value={progress * 100} />
        </div>
      )}

      <PaymentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onPaid={handlePaid}
      />
      <ErrorDialog message={error} onClose={clearError} />
    </div>
  );
}
