import {
  HttpDeliveryError,
  type RetryOptions,
  withRetry,
} from "./retry";
import type {
  DeliveryClient,
  DeliveryRequestOptions,
  DeliveryResponse,
} from "./types";

export interface CreateDeliveryClientOptions {
  retry?: Pick<RetryOptions, "sleep">;
  fetch?: typeof fetch;
}

const DELIVERY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const DELIVERY_STATUSES = new Set([
  "created",
  "uploaded",
  "email_pending",
  "email_accepted",
  "failed",
]);
const DELIVERY_RESPONSE_KEYS = new Set([
  "deliveryId",
  "status",
  "downloadUrl",
  "uploadUrl",
  "uploadHeaders",
  "retryable",
  "error",
]);
const UNSAFE_HEADER_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export class DeliveryProtocolError extends Error {
  constructor(message = "The video delivery service returned an invalid response.") {
    super(message);
    this.name = "DeliveryProtocolError";
  }
}

const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || (status >= 500 && status <= 599);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isSafeHeaders = (
  value: unknown,
): value is Record<string, string> =>
  isPlainRecord(value) &&
  Object.entries(value).every(
    ([name, headerValue]) =>
      !UNSAFE_HEADER_KEYS.has(name) &&
      HEADER_NAME_PATTERN.test(name) &&
      typeof headerValue === "string" &&
      !/[\r\n]/.test(headerValue),
  );

const isSafeError = (
  value: unknown,
): value is { message: string } =>
  isPlainRecord(value) &&
  Object.keys(value).length === 1 &&
  typeof value.message === "string" &&
  value.message.length > 0;

const validateDeliveryResponse = (
  value: unknown,
  expectedDeliveryId: string,
  expectsUploadTarget: boolean,
): DeliveryResponse => {
  if (
    !isPlainRecord(value) ||
    Object.keys(value).some((key) => !DELIVERY_RESPONSE_KEYS.has(key)) ||
    !DELIVERY_ID_PATTERN.test(expectedDeliveryId) ||
    value.deliveryId !== expectedDeliveryId ||
    typeof value.status !== "string" ||
    !DELIVERY_STATUSES.has(value.status) ||
    !isHttpUrl(value.downloadUrl) ||
    typeof value.retryable !== "boolean"
  ) {
    throw new DeliveryProtocolError();
  }

  const hasUploadUrl = Object.hasOwn(value, "uploadUrl");
  const hasUploadHeaders = Object.hasOwn(value, "uploadHeaders");
  const hasError = Object.hasOwn(value, "error");
  if (
    hasUploadUrl !== hasUploadHeaders ||
    (!expectsUploadTarget && hasUploadUrl) ||
    (hasUploadUrl &&
      (!isHttpUrl(value.uploadUrl) || !isSafeHeaders(value.uploadHeaders))) ||
    (hasError && !isSafeError(value.error))
  ) {
    throw new DeliveryProtocolError();
  }

  switch (value.status) {
    case "created":
      if ((expectsUploadTarget && !hasUploadUrl) || hasError) {
        throw new DeliveryProtocolError();
      }
      break;
    case "uploaded":
      if (hasUploadUrl || hasError) {
        throw new DeliveryProtocolError();
      }
      break;
    case "email_pending":
    case "email_accepted":
      if (hasUploadUrl || hasError || value.retryable) {
        throw new DeliveryProtocolError();
      }
      break;
    case "failed":
      if (!hasError) {
        throw new DeliveryProtocolError();
      }
      break;
  }

  return value as unknown as DeliveryResponse;
};

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
  if (
    options.retry &&
    Object.hasOwn(options.retry as object, "signal")
  ) {
    throw new TypeError(
      "Delivery cancellation must be supplied per request.",
    );
  }
  const root = baseUrl.replace(/\/+$/, "");
  const deliveryPath = `${root}/payment/ejector/${encodeURIComponent(paymentCode)}/deliveries`;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const run = <T>(
    operation: () => Promise<T>,
    requestOptions?: DeliveryRequestOptions,
  ): Promise<T> =>
    withRetry(operation, {
      sleep: options.retry?.sleep,
      signal: requestOptions?.signal,
    });

  const requestDelivery = async (
    url: string,
    expectedDeliveryId: string,
    expectsUploadTarget: boolean,
    init?: RequestInit,
  ): Promise<DeliveryResponse> => {
    const response = await fetchImpl(url, init);
    if (!response.ok) {
      return throwForResponse(response);
    }
    return validateDeliveryResponse(
      await response.json(),
      expectedDeliveryId,
      expectsUploadTarget,
    );
  };

  return {
    initialize: (input, requestOptions) =>
      run(() =>
        requestDelivery(deliveryPath, input.deliveryId, true, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliveryId: input.deliveryId,
            tier: input.tier,
            contentLength: input.contentLength,
            checksum: input.checksum,
            contentType: "video/mp4",
          }),
          signal: requestOptions?.signal,
        }),
        requestOptions,
      ),

    upload: (target, blob, requestOptions) => {
      if (!target.uploadUrl || !target.uploadHeaders) {
        return Promise.reject(
          new Error("Video delivery is missing its signed upload target."),
        );
      }

      return run(async () => {
        const response = await fetchImpl(target.uploadUrl as string, {
          method: "PUT",
          headers: target.uploadHeaders,
          body: blob,
          signal: requestOptions?.signal,
        });
        if (!response.ok) {
          await throwForResponse(response);
        }
      }, requestOptions);
    },

    complete: (deliveryId, requestOptions) =>
      run(() =>
        requestDelivery(
          `${deliveryPath}/${encodeURIComponent(deliveryId)}/complete`,
          deliveryId,
          false,
          { method: "POST", signal: requestOptions?.signal },
        ),
        requestOptions,
      ),

    getStatus: (deliveryId, requestOptions) =>
      run(() =>
        requestDelivery(
          `${deliveryPath}/${encodeURIComponent(deliveryId)}`,
          deliveryId,
          false,
          { signal: requestOptions?.signal },
        ),
        requestOptions,
      ),

    retry: (deliveryId, requestOptions) =>
      run(() =>
        requestDelivery(
          `${deliveryPath}/${encodeURIComponent(deliveryId)}/retry`,
          deliveryId,
          true,
          { method: "POST", signal: requestOptions?.signal },
        ),
        requestOptions,
      ),
  };
}
