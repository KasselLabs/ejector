import {
  afterEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import {
  createDeliveryClient,
  type CreateDeliveryClientOptions,
  DeliveryProtocolError,
} from "./client";
import { HttpDeliveryError } from "./retry";
import { finishVideoDelivery } from "./finishVideoDelivery";
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
  it("exposes only retry sleep configuration at the client factory", () => {
    type FactoryRetryKeys =
      keyof NonNullable<CreateDeliveryClientOptions["retry"]>;

    expectTypeOf<FactoryRetryKeys>().toEqualTypeOf<"sleep">();
  });

  it("rejects an untyped factory retry signal instead of silently ignoring it", () => {
    const unsafeOptions = {
      retry: { signal: new AbortController().signal },
    } as unknown as CreateDeliveryClientOptions;

    expect(() =>
      createDeliveryClient(
        "http://payment-api.test",
        "code",
        unsafeOptions,
      ),
    ).toThrow("per request");
  });

  it("whitelists initialize fields so runtime email and extras never cross the network", async () => {
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
    );
    const client = createDeliveryClient(
      "http://payment-api.test/",
      "code with/slash",
    );
    const unsafeInput = {
      ...initializeInput,
      email: "attacker@example.test",
      extra: "must-not-cross-the-wire",
    };

    await expect(client.initialize(unsafeInput)).resolves.toEqual(
      initialized,
    );
  });

  it("passes the original Blob directly to fetch with every signed header", async () => {
    const blob = new Blob(["abc"], { type: "video/mp4" });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const client = createDeliveryClient("http://payment-api.test", "code", {
      fetch: fetchImpl,
    });

    await expect(client.upload(initialized, blob)).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.body).toBe(blob);
    expect(new Uint8Array(await (init?.body as Blob).arrayBuffer())).toEqual(
      new Uint8Array(await blob.arrayBuffer()),
    );
    expect(init?.headers).toEqual(initialized.uploadHeaders);
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

  it("accepts status-only created and expired uploaded responses without upload targets", async () => {
    const statusResponses = [
      {
        deliveryId: DELIVERY_ID,
        status: "created",
        downloadUrl: DOWNLOAD_URL,
        retryable: false,
      },
      {
        deliveryId: DELIVERY_ID,
        status: "uploaded",
        downloadUrl: DOWNLOAD_URL,
        retryable: false,
      },
    ];
    server.use(
      http.get(
        `http://payment-api.test/payment/ejector/code/deliveries/${DELIVERY_ID}`,
        () => HttpResponse.json(statusResponses.shift()),
      ),
    );
    const client = createDeliveryClient("http://payment-api.test", "code");

    await expect(client.getStatus(DELIVERY_ID)).resolves.toMatchObject({
      status: "created",
      retryable: false,
    });
    await expect(client.getStatus(DELIVERY_ID)).resolves.toMatchObject({
      status: "uploaded",
      retryable: false,
    });
  });

  it("requires an initialized created response to contain its signed upload target", async () => {
    server.use(
      http.post(
        "http://payment-api.test/payment/ejector/code/deliveries",
        () => HttpResponse.json({
          deliveryId: DELIVERY_ID,
          status: "created",
          downloadUrl: DOWNLOAD_URL,
          retryable: true,
        }),
      ),
    );
    const client = createDeliveryClient("http://payment-api.test", "code");

    await expect(client.initialize(initializeInput)).rejects.toBeInstanceOf(
      DeliveryProtocolError,
    );
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
    const uploaded: DeliveryResponse = {
      deliveryId: DELIVERY_ID,
      status: "uploaded",
      downloadUrl: DOWNLOAD_URL,
      retryable: true,
    };
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
        () => failOnce("complete", () => HttpResponse.json(uploaded)),
      ),
      http.get(
        `http://payment-api.test/payment/ejector/code/deliveries/${DELIVERY_ID}`,
        () => failOnce("status", () => HttpResponse.json(uploaded)),
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

  it.each([
    [
      "invalid status",
      { ...initialized, status: "sent" },
    ],
    [
      "missing retryable",
      (({ retryable: _retryable, ...rest }) => rest)(initialized),
    ],
    [
      "mismatched delivery ID",
      {
        ...initialized,
        deliveryId: "ad5e0bb4-9770-48e0-9e08-680f88fa76e1",
      },
    ],
    [
      "non-string upload header",
      {
        ...initialized,
        uploadHeaders: { "content-type": 123 },
      },
    ],
    [
      "incomplete accepted payload",
      {
        deliveryId: DELIVERY_ID,
        status: "email_accepted",
        retryable: false,
      },
    ],
    [
      "sensitive extra field",
      {
        ...initialized,
        email: "paid@example.test",
      },
    ],
  ])("rejects a successful response with %s", async (_label, payload) => {
    server.use(
      http.get(
        `http://payment-api.test/payment/ejector/code/deliveries/${DELIVERY_ID}`,
        () => HttpResponse.json(payload),
      ),
    );
    const client = createDeliveryClient("http://payment-api.test", "code");

    await expect(client.getStatus(DELIVERY_ID)).rejects.toBeInstanceOf(
      DeliveryProtocolError,
    );
  });

  it("reconciles a stored upload when the first response is lost and retry returns 412", async () => {
    const blob = new Blob(["abc"], { type: "video/mp4" });
    let putAttempts = 0;
    let initializedDeliveryId: unknown;
    server.use(
      http.post(
        "http://payment-api.test/payment/ejector/code/deliveries",
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          initializedDeliveryId = body.deliveryId;
          return HttpResponse.json(initialized);
        },
      ),
      http.put(UPLOAD_URL, ({ request }) => {
        putAttempts += 1;
        expect(request.headers.get("x-amz-checksum-sha256")).toBe(CHECKSUM);
        return putAttempts === 1
          ? HttpResponse.error()
          : new HttpResponse(null, { status: 412 });
      }),
      http.post(
        `http://payment-api.test/payment/ejector/code/deliveries/${DELIVERY_ID}/complete`,
        () => HttpResponse.json({
          deliveryId: DELIVERY_ID,
          status: "email_accepted",
          downloadUrl: DOWNLOAD_URL,
          retryable: false,
        }),
      ),
    );
    const retrySleep = vi.fn().mockResolvedValue(undefined);
    const client = createDeliveryClient("http://payment-api.test", "code", {
      retry: { sleep: retrySleep },
    });

    await expect(
      finishVideoDelivery({
        client,
        blob,
        deliveryId: DELIVERY_ID,
        tier: "full-hd",
      }),
    ).resolves.toMatchObject({ status: "email_accepted" });

    expect(initializedDeliveryId).toBe(DELIVERY_ID);
    expect(putAttempts).toBe(2);
    expect(retrySleep).toHaveBeenCalledWith(1000);
  });
});
