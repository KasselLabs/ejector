const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

type Sleep = (milliseconds: number) => Promise<void>;

export interface RetryOptions {
  sleep?: Sleep;
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

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "AbortError" || error.name === "TimeoutError");

const isRetryable = (error: unknown): boolean => {
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

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (!isRetryable(error) || delay === undefined) {
        throw error;
      }
      await sleep(delay);
    }
  }
}
