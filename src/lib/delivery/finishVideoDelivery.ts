import { sha256Base64 } from "./checksum";
import { isAmbiguousUploadError } from "./retry";
import type {
  AcceptedDelivery,
  DeliveryClient,
  DeliveryResponse,
  DeliveryTier,
} from "./types";

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_POLL_TIMEOUT_MS = 90_000;

type PollSleep = (milliseconds: number) => Promise<void>;
type TimerHandle = ReturnType<typeof setTimeout>;
type ScheduleTimeout = (
  callback: () => void,
  milliseconds: number,
) => TimerHandle;
type CancelTimeout = (handle: TimerHandle) => void;

export interface FinishVideoDeliveryInput {
  client: DeliveryClient;
  blob: Blob;
  deliveryId: string;
  tier: DeliveryTier;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  pollSleep?: PollSleep;
  now?: () => number;
  scheduleTimeout?: ScheduleTimeout;
  cancelTimeout?: CancelTimeout;
}

const defaultPollSleep: PollSleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const defaultScheduleTimeout: ScheduleTimeout = (callback, milliseconds) =>
  setTimeout(callback, milliseconds);

const defaultCancelTimeout: CancelTimeout = (handle) => {
  clearTimeout(handle);
};

export class DeliveryError extends Error {
  readonly status: DeliveryResponse["status"];
  readonly retryable: boolean;

  constructor(
    message: string,
    response: Pick<DeliveryResponse, "status" | "retryable">,
  ) {
    super(message);
    this.name = "DeliveryError";
    this.status = response.status;
    this.retryable = response.retryable;
  }

  static from(response: DeliveryResponse): DeliveryError {
    return new DeliveryError(
      response.error?.message ?? "Video delivery could not be finished.",
      response,
    );
  }
}

const deadlineError = (): DeliveryError =>
  new DeliveryError(
    "Video delivery is still being finished. Please retry.",
    { status: "failed", retryable: true },
  );

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? deadlineError();

const waitForPoll = (
  sleep: Promise<void>,
  signal: AbortSignal,
): Promise<void> => {
  if (signal.aborted) {
    return Promise.reject(abortReason(signal));
  }

  return new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    sleep.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
};

const runWithDeadline = <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  scheduleTimeout: ScheduleTimeout,
  cancelTimeout: CancelTimeout,
): Promise<T> => {
  const controller = new AbortController();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = scheduleTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      const error = deadlineError();
      controller.abort(error);
      reject(error);
    }, timeoutMs);

    operation(controller.signal).then(
      (value) => {
        if (!settled) {
          settled = true;
          cancelTimeout(timer);
          resolve(value);
        }
      },
      (error: unknown) => {
        if (!settled) {
          settled = true;
          cancelTimeout(timer);
          reject(error);
        }
      },
    );
  });
};

const finishUntilPolling = async ({
  client,
  blob,
  deliveryId,
  tier,
}: FinishVideoDeliveryInput): Promise<DeliveryResponse> => {
  const checksum = await sha256Base64(blob);
  let current = await client.initialize({
    deliveryId,
    tier,
    contentLength: blob.size,
    checksum,
  });

  if (current.status === "failed") {
    current = await client.retry(deliveryId);
  }

  const hasUploadTarget = Boolean(current.uploadUrl && current.uploadHeaders);
  let shouldComplete =
    current.status === "created" || current.status === "uploaded";
  if (
    hasUploadTarget &&
    (current.status === "created" || current.status === "failed")
  ) {
    try {
      await client.upload(current, blob);
      shouldComplete = true;
    } catch (error) {
      if (!isAmbiguousUploadError(error)) {
        throw error;
      }
      try {
        current = await client.complete(deliveryId);
      } catch (completionError) {
        if (!isAmbiguousUploadError(completionError)) {
          throw completionError;
        }
        current = await client.getStatus(deliveryId);
      }
      shouldComplete = false;
    }
  } else if (current.status === "created") {
    throw DeliveryError.from({
      ...current,
      error: {
        message: "Video delivery is missing its signed upload target.",
      },
    });
  }

  if (shouldComplete) {
    current = await client.complete(deliveryId);
  }

  return current;
};

const pollUntilAccepted = async (
  {
    client,
    deliveryId,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    pollTimeoutMs = DEFAULT_POLL_TIMEOUT_MS,
    pollSleep = defaultPollSleep,
    now = Date.now,
  }: FinishVideoDeliveryInput,
  initial: DeliveryResponse,
  signal: AbortSignal,
): Promise<AcceptedDelivery> => {
  let current = initial;
  const deadline = now() + pollTimeoutMs;
  while (current.status === "email_pending" || current.status === "uploaded") {
    if (now() >= deadline) {
      throw deadlineError();
    }
    await waitForPoll(pollSleep(pollIntervalMs), signal);
    current = await client.getStatus(deliveryId, { signal });
  }

  if (current.status !== "email_accepted") {
    throw DeliveryError.from(current);
  }

  return current as AcceptedDelivery;
};

export function finishVideoDelivery(
  input: FinishVideoDeliveryInput,
): Promise<AcceptedDelivery> {
  const {
    pollTimeoutMs = DEFAULT_POLL_TIMEOUT_MS,
    scheduleTimeout = defaultScheduleTimeout,
    cancelTimeout = defaultCancelTimeout,
  } = input;

  return finishUntilPolling(input).then((current) => {
    if (current.status !== "email_pending" && current.status !== "uploaded") {
      if (current.status !== "email_accepted") {
        throw DeliveryError.from(current);
      }
      return current as AcceptedDelivery;
    }

    return runWithDeadline(
      (signal) => pollUntilAccepted(input, current, signal),
      pollTimeoutMs,
      scheduleTimeout,
      cancelTimeout,
    );
  });
}
