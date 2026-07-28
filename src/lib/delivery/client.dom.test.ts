import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { createDeliveryClient } from "./client";
import { HttpDeliveryError } from "./retry";
import type {
  DeliveryResponse,
  InitializeDeliveryInput,
} from "./types";

const DELIVERY_ID = "3bd2a21e-678b-4d19-a675-410b1eb8c892";
const CHECKSUM = "ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=";
const DOWNLOAD_URL = "https://cdn.test/ejector/videos/random.mp4";
const UPLOAD_URL = "https://storage.test/upload";

const initializeInput: InitializeDeliveryInput = {
  deliveryId: DELIVERY_ID,
  tier: "full-hd",
  contentLength: 3,
  checksum: CHECKSUM,
};

const initialized: DeliveryResponse = {
  deliveryId: DELIVERY_ID,
  status: "created",
  downloadUrl: DOWNLOAD_URL,
  uploadUrl: UPLOAD_URL,
  uploadHeaders: {
    "content-type": "video/mp4",
    "x-amz-checksum-sha256": CHECKSUM,
    "x-amz-meta-delivery": DELIVERY_ID,
  },
  retryable: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createDeliveryClient", () => {
  it("never sends an email and uploads the exact Blob with every signed header", async () => {
    const blob = new Blob(["abc"], { type: "video/mp4" });
    server.use(
      http.post(
        "http://payment-api.test/payment/ejector/code%20with%2Fslash/deliveries",
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toEqual({
            ...initializeInput,
            contentType: "video/mp4",
          });
          expect(body).not.toHaveProperty("email");
          return HttpResponse.json(initialized, { status: 201 });
        },
      ),
      http.put(UPLOAD_URL, async ({ request }) => {
        expect(new Uint8Array(await request.arrayBuffer())).toEqual(
          new Uint8Array(await blob.arrayBuffer()),
        );
        for (const [header, value] of Object.entries(
          initialized.uploadHeaders ?? {},
        )) {
          expect(request.headers.get(header)).toBe(value);
        }
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const client = createDeliveryClient(
      "http://payment-api.test/",
      "code with/slash",
    );

    await expect(client.initialize(initializeInput)).resolves.toEqual(
      initialized,
    );
    await expect(client.upload(initialized, blob)).resolves.toBeUndefined();
  });

  it("uses the delivery endpoints for complete, status, and retry", async () => {
    const accepted: DeliveryResponse = {
      ...initialized,
      status: "email_accepted",
      uploadUrl: undefined,
      uploadHeaders: undefined,
      retryable: false,
    };
    const seenMethods: string[] = [];
    server.use(
      http.post(
        `http://payment-api.test/payment/ejector/code/deliveries/${DELIVERY_ID}/complete`,
        ({ request }) => {
          seenMethods.push(request.method);
          return HttpResponse.json({ ...accepted, status: "email_pending" });
        },
      ),
      http.get(
        `http://payment-api.test/payment/ejector/code/deliveries/${DELIVERY_ID}`,
        ({ request }) => {
          seenMethods.push(request.method);
          return HttpResponse.json(accepted);
        },
      ),
      http.post(
        `http://payment-api.test/payment/ejector/code/deliveries/${DELIVERY_ID}/retry`,
        ({ request }) => {
          seenMethods.push(request.method);
          return HttpResponse.json(accepted);
        },
      ),
    );
    const client = createDeliveryClient("http://payment-api.test", "code");

    await expect(client.complete(DELIVERY_ID)).resolves.toMatchObject({
      status: "email_pending",
    });
    await expect(client.getStatus(DELIVERY_ID)).resolves.toEqual(accepted);
    await expect(client.retry(DELIVERY_ID)).resolves.toEqual(accepted);
    expect(seenMethods).toEqual(["POST", "GET", "POST"]);
  });

  it("exposes safe HTTP failures without retrying non-retryable responses", async () => {
    server.use(
      http.post(
        "http://payment-api.test/payment/ejector/code/deliveries",
        () =>
          HttpResponse.json(
            { error: { message: "Invalid video delivery request." } },
            { status: 400 },
          ),
      ),
    );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createDeliveryClient("http://payment-api.test", "code", {
      retry: { sleep },
    });

    await expect(client.initialize(initializeInput)).rejects.toEqual(
      expect.objectContaining<Partial<HttpDeliveryError>>({
        status: 400,
        retryable: false,
        message: "Invalid video delivery request.",
      }),
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it("applies retry classification to initialize, upload, complete, status, and retry", async () => {
    const blob = new Blob(["abc"], { type: "video/mp4" });
    const attempts = new Map<string, number>();
    const failOnce = (key: string, response: () => Response) => {
      const count = attempts.get(key) ?? 0;
      attempts.set(key, count + 1);
      return count === 0
        ? HttpResponse.json(
            { error: { message: "Video delivery could not be finished yet." } },
            { status: 503 },
          )
        : response();
    };
    server.use(
      http.post(
        "http://payment-api.test/payment/ejector/code/deliveries",
        () => failOnce("initialize", () => HttpResponse.json(initialized)),
      ),
      http.put(UPLOAD_URL, () =>
        failOnce("upload", () => new HttpResponse(null, { status: 200 })),
      ),
      http.post(
        `http://payment-api.test/payment/ejector/code/deliveries/${DELIVERY_ID}/complete`,
        () => failOnce("complete", () => HttpResponse.json(initialized)),
      ),
      http.get(
        `http://payment-api.test/payment/ejector/code/deliveries/${DELIVERY_ID}`,
        () => failOnce("status", () => HttpResponse.json(initialized)),
      ),
      http.post(
        `http://payment-api.test/payment/ejector/code/deliveries/${DELIVERY_ID}/retry`,
        () => failOnce("retry", () => HttpResponse.json(initialized)),
      ),
    );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createDeliveryClient("http://payment-api.test", "code", {
      retry: { sleep },
    });

    await client.initialize(initializeInput);
    await client.upload(initialized, blob);
    await client.complete(DELIVERY_ID);
    await client.getStatus(DELIVERY_ID);
    await client.retry(DELIVERY_ID);

    expect(Object.fromEntries(attempts)).toEqual({
      initialize: 2,
      upload: 2,
      complete: 2,
      status: 2,
      retry: 2,
    });
    expect(sleep).toHaveBeenCalledTimes(5);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("rejects an upload response without a signed target before fetching", async () => {
    const client = createDeliveryClient("http://payment-api.test", "code");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      client.upload(
        {
          deliveryId: DELIVERY_ID,
          status: "created",
          downloadUrl: DOWNLOAD_URL,
          retryable: true,
        },
        new Blob(["abc"], { type: "video/mp4" }),
      ),
    ).rejects.toThrow("signed upload target");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
