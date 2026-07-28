import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DeliveryError,
  finishVideoDelivery,
} from "./finishVideoDelivery";
import { withRetry } from "./retry";
import type {
  DeliveryClient,
  DeliveryResponse,
} from "./types";

const DELIVERY_ID = "3bd2a21e-678b-4d19-a675-410b1eb8c892";
const CHECKSUM = "ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=";
const DOWNLOAD_URL = "https://cdn.test/ejector/videos/random.mp4";
const blob = new Blob(["abc"], { type: "video/mp4" });

const response = (
  status: DeliveryResponse["status"],
  overrides: Partial<DeliveryResponse> = {},
): DeliveryResponse => ({
  deliveryId: DELIVERY_ID,
  status,
  downloadUrl: DOWNLOAD_URL,
  retryable: status !== "email_accepted",
  ...overrides,
});

const clientWith = (
  initializeResult: DeliveryResponse,
  overrides: Partial<DeliveryClient> = {},
): DeliveryClient => ({
  initialize: vi.fn().mockResolvedValue(initializeResult),
  upload: vi.fn().mockResolvedValue(undefined),
  complete: vi.fn().mockResolvedValue(response("email_accepted")),
  getStatus: vi.fn().mockResolvedValue(response("email_accepted")),
  retry: vi.fn().mockResolvedValue(response("email_accepted")),
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("finishVideoDelivery", () => {
  it("initializes, uploads, and completes one exact rendered Blob", async () => {
    const initialized = response("created", {
      uploadUrl: "https://storage.test/upload",
      uploadHeaders: {
        "content-type": "video/mp4",
        "x-amz-checksum-sha256": CHECKSUM,
      },
    });
    const accepted = response("email_accepted");
    const client = clientWith(initialized, {
      complete: vi.fn().mockResolvedValue(accepted),
    });

    await expect(
      finishVideoDelivery({
        client,
        blob,
        deliveryId: DELIVERY_ID,
        tier: "full-hd",
      }),
    ).resolves.toEqual(accepted);

    expect(client.initialize).toHaveBeenCalledWith(
      {
        deliveryId: DELIVERY_ID,
        tier: "full-hd",
        contentLength: 3,
        checksum: CHECKSUM,
      },
    );
    expect(client.upload).toHaveBeenCalledWith(
      initialized,
      blob,
    );
    expect(client.complete).toHaveBeenCalledWith(DELIVERY_ID);
    expect(client.getStatus).not.toHaveBeenCalled();
    expect(client.retry).not.toHaveBeenCalled();
  });

  it("returns an already accepted delivery without repeating completed work", async () => {
    const accepted = response("email_accepted");
    const client = clientWith(accepted);

    await expect(
      finishVideoDelivery({
        client,
        blob,
        deliveryId: DELIVERY_ID,
        tier: "hd",
      }),
    ).resolves.toEqual(accepted);

    expect(client.upload).not.toHaveBeenCalled();
    expect(client.complete).not.toHaveBeenCalled();
    expect(client.getStatus).not.toHaveBeenCalled();
    expect(client.retry).not.toHaveBeenCalled();
  });

  it("resumes the backend's failed upload state with the same UUID and Blob", async () => {
    const failed = response("failed", {
      error: { message: "The video upload could not be verified yet." },
    });
    const retryTarget = response("failed", {
      error: { message: "The video upload could not be verified yet." },
      uploadUrl: "https://storage.test/retry-upload",
      uploadHeaders: { "x-amz-checksum-sha256": CHECKSUM },
    });
    const accepted = response("email_accepted");
    const client = clientWith(failed, {
      retry: vi.fn().mockResolvedValue(retryTarget),
      complete: vi.fn().mockResolvedValue(accepted),
    });

    await expect(
      finishVideoDelivery({
        client,
        blob,
        deliveryId: DELIVERY_ID,
        tier: "full-hd",
      }),
    ).resolves.toEqual(accepted);

    expect(client.retry).toHaveBeenCalledWith(DELIVERY_ID);
    expect(client.upload).toHaveBeenCalledWith(
      retryTarget,
      blob,
    );
    expect(client.complete).toHaveBeenCalledWith(DELIVERY_ID);
    expect(client.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: DELIVERY_ID }),
    );
  });

  it("skips upload when recovery reports that it already succeeded", async () => {
    const accepted = response("email_accepted");
    const client = clientWith(response("uploaded"), {
      complete: vi.fn().mockResolvedValue(accepted),
    });

    await expect(
      finishVideoDelivery({
        client,
        blob,
        deliveryId: DELIVERY_ID,
        tier: "hd",
      }),
    ).resolves.toEqual(accepted);

    expect(client.upload).not.toHaveBeenCalled();
    expect(client.complete).toHaveBeenCalledWith(DELIVERY_ID);
  });

  it("polls pending and uploaded states at a separate 1-second interval", async () => {
    const client = clientWith(response("email_pending"), {
      getStatus: vi
        .fn()
        .mockResolvedValueOnce(response("email_pending"))
        .mockResolvedValueOnce(response("uploaded"))
        .mockResolvedValueOnce(response("email_accepted")),
    });
    const pollSleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      finishVideoDelivery({
        client,
        blob,
        deliveryId: DELIVERY_ID,
        tier: "full-hd",
        pollSleep,
      }),
    ).resolves.toMatchObject({ status: "email_accepted" });

    expect(pollSleep.mock.calls.map(([ms]) => ms)).toEqual([
      1000, 1000, 1000,
    ]);
    expect(client.getStatus).toHaveBeenCalledTimes(3);
    expect(client.getStatus).toHaveBeenCalledWith(
      DELIVERY_ID,
      { signal: expect.any(AbortSignal) },
    );
  });

  it("starts a fresh full deadline only after slow pre-poll delivery work", async () => {
    let now = 0;
    let deadlineStartedAt: number | undefined;
    const initialized = response("created", {
      uploadUrl: "https://storage.test/upload",
      uploadHeaders: { "x-amz-checksum-sha256": CHECKSUM },
    });
    const client = clientWith(initialized, {
      upload: vi.fn(async () => {
        now += 5000;
      }),
      complete: vi.fn().mockResolvedValue(response("email_pending")),
      getStatus: vi.fn().mockResolvedValue(response("email_accepted")),
    });
    const pollSleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const scheduleTimeout = vi.fn(
      (callback: () => void, milliseconds: number) => {
        deadlineStartedAt = now;
        return setTimeout(callback, milliseconds);
      },
    );

    await expect(
      finishVideoDelivery({
        client,
        blob,
        deliveryId: DELIVERY_ID,
        tier: "full-hd",
        pollTimeoutMs: 2500,
        pollSleep,
        now: () => now,
        scheduleTimeout,
      }),
    ).resolves.toMatchObject({ status: "email_accepted" });

    expect(deadlineStartedAt).toBe(5000);
    expect(scheduleTimeout).toHaveBeenCalledTimes(1);
    expect(scheduleTimeout).toHaveBeenCalledWith(expect.any(Function), 2500);
    expect(pollSleep).toHaveBeenCalledWith(1000);
  });

  it("rejects an acceptance that arrives after the hard orchestration deadline", async () => {
    vi.useFakeTimers();
    let statusSignal: AbortSignal | undefined;
    let resolveStatusStarted: (() => void) | undefined;
    const statusStarted = new Promise<void>((resolve) => {
      resolveStatusStarted = resolve;
    });
    const client = clientWith(response("email_pending"), {
      getStatus: vi.fn((_deliveryId, options) => {
        statusSignal = options?.signal;
        resolveStatusStarted?.();
        return new Promise<DeliveryResponse>((resolve) => {
          setTimeout(() => resolve(response("email_accepted")), 3000);
        });
      }),
    });

    const finishing = finishVideoDelivery({
      client,
      blob,
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      pollTimeoutMs: 2500,
      pollSleep: vi.fn().mockResolvedValue(undefined),
    });
    const rejection = expect(finishing).rejects.toEqual(
      expect.objectContaining<Partial<DeliveryError>>({
        name: "DeliveryError",
        retryable: true,
      }),
    );
    await statusStarted;
    expect(statusSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2500);

    await rejection;
    expect(statusSignal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
  });

  it("counts the one-second poll delay against the polling deadline", async () => {
    let fireDeadline: (() => void) | undefined;
    let resolvePollStarted: (() => void) | undefined;
    const pollStarted = new Promise<void>((resolve) => {
      resolvePollStarted = resolve;
    });
    const pollSleep = vi.fn(() => {
      resolvePollStarted?.();
      return new Promise<void>(() => undefined);
    });
    const client = clientWith(response("email_pending"));
    const finishing = finishVideoDelivery({
      client,
      blob,
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      pollTimeoutMs: 500,
      pollSleep,
      scheduleTimeout: (callback) => {
        fireDeadline = callback;
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      cancelTimeout: vi.fn(),
    });
    const rejection = expect(finishing).rejects.toEqual(
      expect.objectContaining<Partial<DeliveryError>>({
        name: "DeliveryError",
        retryable: true,
      }),
    );
    await pollStarted;
    fireDeadline?.();

    await rejection;
    expect(pollSleep).toHaveBeenCalledWith(1000);
    expect(client.getStatus).not.toHaveBeenCalled();
  });

  it("aborts getStatus retry backoff inside the polling deadline", async () => {
    vi.useFakeTimers();
    let statusSignal: AbortSignal | undefined;
    let resolveStatusStarted: (() => void) | undefined;
    const statusStarted = new Promise<void>((resolve) => {
      resolveStatusStarted = resolve;
    });
    const statusAttempt = vi
      .fn<() => Promise<DeliveryResponse>>()
      .mockRejectedValue(new TypeError("offline"));
    const client = clientWith(response("email_pending"), {
      getStatus: vi.fn((_deliveryId, options) => {
        statusSignal = options?.signal;
        resolveStatusStarted?.();
        return withRetry(statusAttempt, {
          signal: options?.signal,
          sleep: (milliseconds) =>
            new Promise((resolve) => setTimeout(resolve, milliseconds)),
        });
      }),
    });

    const finishing = finishVideoDelivery({
      client,
      blob,
      deliveryId: DELIVERY_ID,
      tier: "full-hd",
      pollTimeoutMs: 2500,
      pollSleep: vi.fn().mockResolvedValue(undefined),
    });
    const rejection = expect(finishing).rejects.toEqual(
      expect.objectContaining<Partial<DeliveryError>>({
        name: "DeliveryError",
        retryable: true,
      }),
    );
    await statusStarted;
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1500);

    await rejection;
    expect(statusSignal?.aborted).toBe(true);
    expect(statusAttempt).toHaveBeenCalledTimes(2);
  });

  it("throws a typed delivery error instead of returning a failed state", async () => {
    const client = clientWith(
      response("failed", {
        retryable: true,
        error: { message: "Finishing failed." },
      }),
      {
        retry: vi.fn().mockResolvedValue(
          response("failed", {
            retryable: false,
            error: { message: "Completion window expired." },
          }),
        ),
      },
    );

    await expect(
      finishVideoDelivery({
        client,
        blob,
        deliveryId: DELIVERY_ID,
        tier: "hd",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<DeliveryError>>({
        message: "Completion window expired.",
        retryable: false,
        status: "failed",
      }),
    );
  });

  it("treats a created response without an upload target as a delivery failure", async () => {
    const client = clientWith(response("created"));

    await expect(
      finishVideoDelivery({
        client,
        blob,
        deliveryId: DELIVERY_ID,
        tier: "hd",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<DeliveryError>>({
        retryable: true,
        status: "created",
      }),
    );
    expect(client.upload).not.toHaveBeenCalled();
    expect(client.complete).not.toHaveBeenCalled();
  });
});
