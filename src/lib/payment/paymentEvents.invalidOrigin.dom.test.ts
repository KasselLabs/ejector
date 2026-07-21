import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaymentSuccessPayload } from "@/types";

// getAllowedOrigin() falls back to the hardcoded payment origin when
// `new URL(paymentPageUrl)` throws (a malformed env var). Exercising that
// requires paymentPageUrl to actually be malformed, hence the separate
// file: mocking @/lib/config here would otherwise leak into every other
// test that imports paymentEvents.ts in the same run.
vi.mock("@/lib/config", () => ({ paymentPageUrl: "not a url" }));

describe("registerPaymentEventsHandler with a malformed NEXT_PUBLIC_PAYMENT_PAGE_URL", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("falls back to the hardcoded payment origin instead of throwing", async () => {
    const { registerPaymentEventsHandler, unregisterPaymentEventsHandler } =
      await import("./paymentEvents");

    const payload: PaymentSuccessPayload = {
      amount: 500,
      finalAmount: 500,
      currency: "usd",
      email: "test@example.com",
      method: "stripe",
    };
    const cb = vi.fn();
    registerPaymentEventsHandler(cb);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "payment", action: "success", payload },
        origin: "https://payment.kassellabs.io",
      }),
    );

    expect(cb).toHaveBeenCalledWith(payload);
    unregisterPaymentEventsHandler();
  });
});
