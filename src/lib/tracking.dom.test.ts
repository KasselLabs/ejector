import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./tracking";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

afterEach(() => {
  delete window.gtag;
});

describe("trackEvent", () => {
  it("forwards to window.gtag when available", () => {
    window.gtag = vi.fn();
    trackEvent("paid", { value: 5 });
    expect(window.gtag).toHaveBeenCalledWith("event", "paid", { value: 5 });
  });

  it("does not throw without gtag", () => {
    expect(() => trackEvent("paid")).not.toThrow();
  });
});
