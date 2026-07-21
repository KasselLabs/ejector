"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { usePayment } from "@/contexts/PaymentProvider";
import {
  registerPaymentEventsHandler,
  unregisterPaymentEventsHandler,
} from "@/lib/payment/paymentEvents";
import { tierForDollarValue } from "@/lib/payment/paidStatus";
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

// The `setAmount` postMessage payload is DECIMAL DOLLARS: payment-frontend
// feeds `event.data.payload` straight into its dollars field and multiplies by
// 100 at Stripe submit. (The iframe `amount` query param below is CENTS — a
// separate, correct contract; do not conflate the two.)
const TIER_AMOUNT_DOLLARS: Record<PaidTier, number> = {
  hd: 3,
  "full-hd": 5,
};

// Poll the backend paid status while the dialog is open so a payment that
// completes without posting a success message back (e.g. a redirect flow) is
// still detected and unlocks the download.
const PAID_POLL_INTERVAL_MS = 5000;

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
  const { code, paid, tier: contextTier, markPaid, refresh } = usePayment();
  const [tier, setTier] = useState<PaidTier>("full-hd");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The effects below must only (un)register/settle once per open dialog
  // session (keyed on `open`), but they need the latest callbacks/markPaid — so
  // those are read through a ref kept current via effect (never written during
  // render) instead of being listed as effect deps.
  const latest = useRef({ markPaid, onClose, onPaid });
  useEffect(() => {
    latest.current = { markPaid, onClose, onPaid };
  });

  // Guards against firing onClose/onPaid more than once per open session (the
  // success message and the paid-status poll can both resolve).
  const handledRef = useRef(false);
  useEffect(() => {
    if (open) handledRef.current = false;
  }, [open]);

  const finish = useCallback((finishTier: PaidTier) => {
    if (handledRef.current) return;
    handledRef.current = true;
    latest.current.onClose();
    latest.current.onPaid(finishTier);
  }, []);

  // Register/unregister the payment success listener only while the dialog
  // is open, so a success message never fires against a stale/closed dialog.
  useEffect(() => {
    if (!open) return;

    trackEvent("modal_payment_open");

    const handleSuccess = (payload: PaymentSuccessPayload) => {
      // finalAmount is DECIMAL DOLLARS (payment-frontend sends amount / 100).
      latest.current.markPaid(payload.finalAmount);
      finish(tierForDollarValue(payload.finalAmount));
    };

    registerPaymentEventsHandler(handleSuccess);
    return () => {
      unregisterPaymentEventsHandler();
    };
  }, [open, finish]);

  // Periodically re-check paid status while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      void refresh();
    }, PAID_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [open, refresh]);

  // When the polled paid status flips true while the dialog is open, close and
  // unlock with the tier resolved from the backend dollar value.
  useEffect(() => {
    if (!open || !paid) return;
    finish(contextTier ?? tier);
  }, [open, paid, contextTier, tier, finish]);

  function handleSelectTier(next: PaidTier) {
    setTier(next);
    iframeRef.current?.contentWindow?.postMessage(
      { action: "setAmount", payload: TIER_AMOUNT_DOLLARS[next] },
      new URL(paymentPageUrl).origin,
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
      <DialogContent className="border border-white bg-black text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Choose your video quality")}</DialogTitle>
          <DialogDescription>
            {t("We provide two video options")}
          </DialogDescription>
        </DialogHeader>

        <TierPicker selected={tier} onSelect={handleSelectTier} />

        <div className="relative min-h-[700px] w-full overflow-hidden rounded-lg">
          {(!iframeLoaded || !code) && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
              {t("Loading")}
            </div>
          )}
          {/* Don't mount the iframe until the client code is available, so it
              never opens with `code=null` and orphans the 24h window. */}
          {code && (
            <iframe
              ref={iframeRef}
              title="Payment Form"
              src={`${paymentPageUrl}?embed=true&app=ejector&code=${code}&amount=500`}
              allow="payment"
              className="relative min-h-[700px] w-full border-0"
              onLoad={() => setIframeLoaded(true)}
            />
          )}
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
