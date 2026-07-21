import { paymentPageUrl } from "@/lib/config";
import type { PaymentSuccessPayload } from "@/types";

type SuccessCallback = (payment: PaymentSuccessPayload) => void;

const callbacks: { success: SuccessCallback | null } = { success: null };

function getAllowedOrigin(): string {
  try {
    return new URL(paymentPageUrl).origin;
  } catch {
    return "https://payment.kassellabs.io";
  }
}

function isPaymentMessage(
  value: unknown,
): value is { type: string; action: string; payload: PaymentSuccessPayload } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.type === "payment" && typeof v.action === "string";
}

function handler(event: MessageEvent): void {
  if (event.origin !== getAllowedOrigin()) return;
  if (!isPaymentMessage(event.data)) return;
  if (event.data.action === "success") {
    callbacks.success?.(event.data.payload);
  }
}

export function registerPaymentEventsHandler(cb: SuccessCallback): void {
  callbacks.success = cb;
  window.addEventListener("message", handler);
}

export function unregisterPaymentEventsHandler(): void {
  callbacks.success = null;
  window.removeEventListener("message", handler);
}
