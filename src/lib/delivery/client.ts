import {
  HttpDeliveryError,
  type RetryOptions,
  withRetry,
} from "./retry";
import type {
  DeliveryClient,
  DeliveryResponse,
} from "./types";

interface CreateDeliveryClientOptions {
  retry?: RetryOptions;
}

const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || (status >= 500 && status <= 599);

const errorMessage = async (response: Response): Promise<string | undefined> => {
  try {
    const body = (await response.json()) as {
      error?: { message?: unknown };
    };
    return typeof body.error?.message === "string"
      ? body.error.message
      : undefined;
  } catch {
    return undefined;
  }
};

const throwForResponse = async (response: Response): Promise<never> => {
  const message = await errorMessage(response);
  throw new HttpDeliveryError(
    response.status,
    isRetryableStatus(response.status),
    message,
  );
};

export function createDeliveryClient(
  baseUrl: string,
  paymentCode: string,
  options: CreateDeliveryClientOptions = {},
): DeliveryClient {
  const root = baseUrl.replace(/\/+$/, "");
  const deliveryPath = `${root}/payment/ejector/${encodeURIComponent(paymentCode)}/deliveries`;
  const run = <T>(operation: () => Promise<T>): Promise<T> =>
    withRetry(operation, options.retry);

  const requestDelivery = async (
    url: string,
    init?: RequestInit,
  ): Promise<DeliveryResponse> => {
    const response = await fetch(url, init);
    if (!response.ok) {
      return throwForResponse(response);
    }
    return (await response.json()) as DeliveryResponse;
  };

  return {
    initialize: (input) =>
      run(() =>
        requestDelivery(deliveryPath, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...input,
            contentType: "video/mp4",
          }),
        }),
      ),

    upload: (target, blob) => {
      if (!target.uploadUrl || !target.uploadHeaders) {
        return Promise.reject(
          new Error("Video delivery is missing its signed upload target."),
        );
      }

      return run(async () => {
        const response = await fetch(target.uploadUrl as string, {
          method: "PUT",
          headers: target.uploadHeaders,
          body: await blob.arrayBuffer(),
        });
        if (!response.ok) {
          await throwForResponse(response);
        }
      });
    },

    complete: (deliveryId) =>
      run(() =>
        requestDelivery(
          `${deliveryPath}/${encodeURIComponent(deliveryId)}/complete`,
          { method: "POST" },
        ),
      ),

    getStatus: (deliveryId) =>
      run(() =>
        requestDelivery(`${deliveryPath}/${encodeURIComponent(deliveryId)}`),
      ),

    retry: (deliveryId) =>
      run(() =>
        requestDelivery(
          `${deliveryPath}/${encodeURIComponent(deliveryId)}/retry`,
          { method: "POST" },
        ),
      ),
  };
}
