import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerPaymentEventsHandler,
  unregisterPaymentEventsHandler,
} from "./paymentEvents";
import type { PaymentSuccessPayload } from "@/types";

const ALLOWED_ORIGIN = "https://payment.kassellabs.io";

const payload: PaymentSuccessPayload = {
  amount: 500,
  finalAmount: 500,
  currency: "usd",
  email: "test@example.com",
  method: "stripe",
};

afterEach(() => {
  unregisterPaymentEventsHandler();
});

describe("registerPaymentEventsHandler", () => {
  it("fires the callback when origin and message shape match", () => {
    const cb = vi.fn();
    registerPaymentEventsHandler(cb);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "payment", action: "success", payload },
        origin: ALLOWED_ORIGIN,
      }),
    );

    expect(cb).toHaveBeenCalledWith(payload);
  });

  it("does not fire the callback when the origin is wrong", () => {
    const cb = vi.fn();
    registerPaymentEventsHandler(cb);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "payment", action: "success", payload },
        origin: "https://evil.example.com",
      }),
    );

    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire the callback when the message shape is wrong", () => {
    const cb = vi.fn();
    registerPaymentEventsHandler(cb);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "not-payment" },
        origin: ALLOWED_ORIGIN,
      }),
    );

    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire the callback when the message data is not an object", () => {
    const cb = vi.fn();
    registerPaymentEventsHandler(cb);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: "not an object",
        origin: ALLOWED_ORIGIN,
      }),
    );

    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire the callback for a non-success payment action", () => {
    const cb = vi.fn();
    registerPaymentEventsHandler(cb);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "payment", action: "cancelled", payload },
        origin: ALLOWED_ORIGIN,
      }),
    );

    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire the callback after unregister", () => {
    const cb = vi.fn();
    registerPaymentEventsHandler(cb);
    unregisterPaymentEventsHandler();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "payment", action: "success", payload },
        origin: ALLOWED_ORIGIN,
      }),
    );

    expect(cb).not.toHaveBeenCalled();
  });
});
