export type DeliveryStatus =
  | "created"
  | "uploaded"
  | "email_pending"
  | "email_accepted"
  | "failed";

export type DeliveryTier = "hd" | "full-hd";

export interface InitializeDeliveryInput {
  deliveryId: string;
  tier: DeliveryTier;
  contentLength: number;
  checksum: string;
}

export interface DeliveryResponse {
  deliveryId: string;
  status: DeliveryStatus;
  downloadUrl: string;
  uploadUrl?: string;
  uploadHeaders?: Record<string, string>;
  retryable: boolean;
  error?: { message: string };
}

export type AcceptedDelivery = DeliveryResponse & {
  status: "email_accepted";
};

export interface DeliveryRequestOptions {
  signal?: AbortSignal;
}

export interface DeliveryClient {
  initialize(
    input: InitializeDeliveryInput,
    options?: DeliveryRequestOptions,
  ): Promise<DeliveryResponse>;
  upload(
    target: DeliveryResponse,
    blob: Blob,
    options?: DeliveryRequestOptions,
  ): Promise<void>;
  complete(
    deliveryId: string,
    options?: DeliveryRequestOptions,
  ): Promise<DeliveryResponse>;
  getStatus(
    deliveryId: string,
    options?: DeliveryRequestOptions,
  ): Promise<DeliveryResponse>;
  retry(
    deliveryId: string,
    options?: DeliveryRequestOptions,
  ): Promise<DeliveryResponse>;
}
