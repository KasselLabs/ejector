"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { usePayment } from "@/contexts/PaymentProvider";
import {
  registerPaymentEventsHandler,
  unregisterPaymentEventsHandler,
} from "@/lib/payment/paymentEvents";
import { tierForCents } from "@/lib/payment/paidStatus";
import { paymentPageUrl } from "@/lib/config";
import { trackEvent } from "@/lib/tracking";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TierPicker } from "@/components/TierPicker";
import { SupportEmailLink } from "@/components/SupportEmailLink";
import type { PaidTier, PaymentSuccessPayload } from "@/types";

const TIER_AMOUNT_CENTS: Record<PaidTier, number> = {
  hd: 300,
  "full-hd": 500,
};

export function PaymentDialog({
  open,
  onClose,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  onPaid: (tier: PaidTier) => void;
}) {
  const t = useT();
  const { code, markPaid } = usePayment();
  const [tier, setTier] = useState<PaidTier>("full-hd");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The effect below must only (un)register once per open dialog session
  // (keyed on `open`), but it needs the latest callbacks/markPaid — so those
  // are read through a ref kept current via effect (never written during
  // render) instead of being listed as effect deps.
  const latest = useRef({ markPaid, onClose, onPaid });
  useEffect(() => {
    latest.current = { markPaid, onClose, onPaid };
  });

  // Register/unregister the payment success listener only while the dialog
  // is open, so a success message never fires against a stale/closed dialog.
  useEffect(() => {
    if (!open) return;

    trackEvent("modal_payment_open");

    const handleSuccess = (payload: PaymentSuccessPayload) => {
      latest.current.markPaid(payload.finalAmount);
      latest.current.onClose();
      latest.current.onPaid(tierForCents(payload.finalAmount));
    };

    registerPaymentEventsHandler(handleSuccess);
    return () => {
      unregisterPaymentEventsHandler();
    };
  }, [open]);

  function handleSelectTier(next: PaidTier) {
    setTier(next);
    iframeRef.current?.contentWindow?.postMessage(
      { action: "setAmount", payload: TIER_AMOUNT_CENTS[next] },
      "*",
    );
  }

  // Reset local UI state on close (event-driven, not effect-driven) so the
  // next open starts from the full-hd / not-yet-loaded defaults.
  function handleClose() {
    setTier("full-hd");
    setIframeLoaded(false);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Choose your video quality")}</DialogTitle>
          <DialogDescription>
            {t("We provide two video options")}
          </DialogDescription>
        </DialogHeader>

        <TierPicker selected={tier} onSelect={handleSelectTier} />

        <div className="relative min-h-[700px] w-full overflow-hidden rounded-lg">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
              {t("Loading")}
            </div>
          )}
          <iframe
            ref={iframeRef}
            title="Payment Form"
            src={`${paymentPageUrl}?embed=true&app=ejector&code=${code}&amount=500`}
            allow="payment"
            className="relative min-h-[700px] w-full border-0"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>

        <p className="text-xs text-white/40">
          {t(
            "After the payment, you'll be able download unlimited videos for a 24 hour period",
          )}
        </p>
        <p className="text-xs text-white/40">
          {t("Need help Contact us via email")} <SupportEmailLink />
        </p>
      </DialogContent>
    </Dialog>
  );
}
