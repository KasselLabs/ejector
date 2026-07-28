const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

type Sleep = (milliseconds: number) => Promise<void>;

export interface RetryOptions {
  sleep?: Sleep;
  signal?: AbortSignal;
}

export class HttpDeliveryError extends Error {
  constructor(
    readonly status: number,
    readonly retryable: boolean,
    message = `Video delivery request failed with status ${status}.`,
  ) {
    super(message);
    this.name = "HttpDeliveryError";
  }
}

const defaultSleep: Sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "AbortError" || error.name === "TimeoutError");

export const isRetryableDeliveryError = (error: unknown): boolean => {
  if (error instanceof TypeError || isTimeoutError(error)) {
    return true;
  }

  return (
    error instanceof HttpDeliveryError &&
    error.retryable &&
    (error.status === 408 ||
      error.status === 429 ||
      (error.status >= 500 && error.status <= 599))
  );
};

export const isAmbiguousUploadError = (error: unknown): boolean =>
  error instanceof TypeError ||
  isTimeoutError(error) ||
  (error instanceof HttpDeliveryError &&
    (error.status === 412 || isRetryableDeliveryError(error)));

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ??
  new DOMException("Video delivery request was aborted.", "AbortError");

const waitForRetry = async (
  sleep: Sleep,
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> => {
  if (!signal) {
    await sleep(milliseconds);
    return;
  }
  if (signal.aborted) {
    throw abortReason(signal);
  }

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    sleep(milliseconds).then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 0; ; attempt += 1) {
    if (options.signal?.aborted) {
      throw abortReason(options.signal);
    }
    try {
      return await operation();
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (
        options.signal?.aborted ||
        !isRetryableDeliveryError(error) ||
        delay === undefined
      ) {
        throw error;
      }
      await waitForRetry(sleep, delay, options.signal);
    }
  }
}
