import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("config", () => {
  it("uses production defaults", async () => {
    // .env.test stubs NEXT_PUBLIC_ADMIN_GRAPHQL_URL for the Playwright dev
    // server / e2e mocks; unset it here so this test still exercises the
    // real fallback used when no env override is present.
    vi.stubEnv("NEXT_PUBLIC_ADMIN_GRAPHQL_URL", undefined);
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
