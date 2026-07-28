import { sha256Base64 } from "./checksum";
import type {
  AcceptedDelivery,
  DeliveryClient,
  DeliveryResponse,
  DeliveryTier,
} from "./types";

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_POLL_TIMEOUT_MS = 90_000;

type PollSleep = (milliseconds: number) => Promise<void>;

export interface FinishVideoDeliveryInput {
  client: DeliveryClient;
  blob: Blob;
  deliveryId: string;
  tier: DeliveryTier;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  pollSleep?: PollSleep;
  now?: () => number;
}

const defaultPollSleep: PollSleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

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

export async function finishVideoDelivery({
  client,
  blob,
  deliveryId,
  tier,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  pollTimeoutMs = DEFAULT_POLL_TIMEOUT_MS,
  pollSleep = defaultPollSleep,
  now = Date.now,
}: FinishVideoDeliveryInput): Promise<AcceptedDelivery> {
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

  if (current.status === "created") {
    if (!current.uploadUrl || !current.uploadHeaders) {
      throw DeliveryError.from({
        ...current,
        error: {
          message: "Video delivery is missing its signed upload target.",
        },
      });
    }
    await client.upload(current, blob);
  }

  if (current.status === "created" || current.status === "uploaded") {
    current = await client.complete(deliveryId);
  }

  const pollDeadline = now() + pollTimeoutMs;
  while (current.status === "email_pending" || current.status === "uploaded") {
    if (now() + pollIntervalMs > pollDeadline) {
      throw new DeliveryError(
        "Video delivery is still being finished. Please retry.",
        { status: current.status, retryable: true },
      );
    }
    await pollSleep(pollIntervalMs);
    current = await client.getStatus(deliveryId);
  }

  if (current.status !== "email_accepted") {
    throw DeliveryError.from(current);
  }

  return current as AcceptedDelivery;
}
