import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("config", () => {
  it("uses production defaults", async () => {
    const config = await import("./config");
    expect(config.paymentPageUrl).toBe("https://payment.kassellabs.io");
    expect(config.adminGraphqlUrl).toBe("https://admin.kassellabs.io/graphql");
  });

  it("strips trailing slashes from env overrides", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_API_URL", "https://pay.test/");
    const config = await import("./config");
    expect(config.paymentApiUrl).toBe("https://pay.test");
  });
});
