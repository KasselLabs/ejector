import { describe, expect, it, vi } from "vitest";
import {
  HttpDeliveryError,
  withRetry,
} from "./retry";

describe("withRetry", () => {
  it("uses one initial call plus 1s, 2s, and 4s retries", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockRejectedValueOnce(new HttpDeliveryError(503, true))
      .mockRejectedValueOnce(new HttpDeliveryError(429, true))
      .mockResolvedValue("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withRetry(operation, { sleep })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
  });

  it.each([408, 429, 500, 503])(
    "retries retryable HTTP status %s",
    async (status) => {
      const operation = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new HttpDeliveryError(status, true))
        .mockResolvedValue("ok");
      const sleep = vi.fn().mockResolvedValue(undefined);

      await expect(withRetry(operation, { sleep })).resolves.toBe("ok");
      expect(operation).toHaveBeenCalledTimes(2);
    },
  );

  it.each([400, 401, 403, 404, 409, 410, 422])(
    "does not retry non-retryable HTTP status %s",
    async (status) => {
      const error = new HttpDeliveryError(status, false);
      const operation = vi.fn<() => Promise<string>>().mockRejectedValue(error);
      const sleep = vi.fn().mockResolvedValue(undefined);

      await expect(withRetry(operation, { sleep })).rejects.toBe(error);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    },
  );

  it("does not classify a status above the 5xx range as retryable", async () => {
    const error = new HttpDeliveryError(600, true);
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withRetry(operation, { sleep })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each(["AbortError", "TimeoutError"])(
    "retries %s timeout failures",
    async (name) => {
      const timeout = Object.assign(new Error("timed out"), { name });
      const operation = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(timeout)
        .mockResolvedValue("ok");
      const sleep = vi.fn().mockResolvedValue(undefined);

      await expect(withRetry(operation, { sleep })).resolves.toBe("ok");
      expect(operation).toHaveBeenCalledTimes(2);
    },
  );

  it("returns the final retryable failure after exhausting all retries", async () => {
    const error = new TypeError("offline");
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withRetry(operation, { sleep })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
  });
});
