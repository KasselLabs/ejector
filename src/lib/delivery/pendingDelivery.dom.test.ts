import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingDelivery,
  readPendingDelivery,
  savePendingDelivery,
} from "./pendingDelivery";

const DELIVERY_ID = "3bd2a21e-678b-4d19-a675-410b1eb8c892";
const STORAGE_KEY = "ejector-pending-delivery";

beforeEach(() => {
  window.localStorage.clear();
});

describe("pending delivery recovery", () => {
  it("stores exactly the delivery ID, tier, and filename", () => {
    savePendingDelivery({
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      filename: "Red-was-ejected.mp4",
    });

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw ?? "null")).toEqual({
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      filename: "Red-was-ejected.mp4",
    });
    expect(raw).not.toContain("payment-code");
    expect(raw).not.toContain("paid@example.com");
    expect(raw).not.toContain("blob:");
  });

  it("returns a strictly valid saved record", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        deliveryId: DELIVERY_ID,
        tier: "hd",
        filename: "Blue-was-ejected.mp4",
      }),
    );

    expect(readPendingDelivery()).toEqual({
      deliveryId: DELIVERY_ID,
      tier: "hd",
      filename: "Blue-was-ejected.mp4",
    });
  });

  it.each([
    "not-json",
    "null",
    "{}",
    JSON.stringify({
      deliveryId: "payment-code",
      tier: "hd",
      filename: "video.mp4",
    }),
    JSON.stringify({
      deliveryId: DELIVERY_ID,
      tier: "ultra-hd",
      filename: "video.mp4",
    }),
    JSON.stringify({
      deliveryId: DELIVERY_ID,
      tier: "hd",
      filename: "",
    }),
    JSON.stringify({
      deliveryId: DELIVERY_ID,
      tier: "hd",
      filename: "video.mp4",
      email: "paid@example.com",
    }),
  ])("clears malformed or over-specified storage: %s", (raw) => {
    window.localStorage.setItem(STORAGE_KEY, raw);

    expect(readPendingDelivery()).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clears the saved record", () => {
    window.localStorage.setItem(STORAGE_KEY, "value");

    clearPendingDelivery();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
