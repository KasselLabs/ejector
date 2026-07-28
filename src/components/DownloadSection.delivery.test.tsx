import { useEffect } from "react";
import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import type { EjectorProps } from "@/types";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";
import { PaymentProvider, usePayment } from "@/contexts/PaymentProvider";
import * as tracking from "@/lib/tracking";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_PAYMENT_API_URL", "http://payment-api.test");
});

const DELIVERY_ID = "3bd2a21e-678b-4d19-a675-410b1eb8c892";
const DOWNLOAD_URL =
  "https://downloads.test/ejector/videos/unguessable-token.mp4";
const UPLOAD_URL = "https://storage.test/ejector-upload";
const CHECKSUM = "OWsAnL1oP/cQX/Xlud7q2qfktPrILC55OrfEbWiJJCE=";
const VIDEO_BYTES = new TextEncoder().encode("exact rendered bytes");
// MSW's Node interceptor needs Node's stream-capable Blob at the fetch
// boundary; jsdom's Blob serializes as the string "undefined".
const renderedBlob = new NodeBlob([VIDEO_BYTES], {
  type: "video/mp4",
}) as Blob;

const checkRenderSupport = vi.fn();
const renderEjectionVideo = vi.fn();
const downloadBlob = vi.fn();

vi.mock("@/lib/render/capability", () => ({
  checkRenderSupport: (...args: unknown[]) => checkRenderSupport(...args),
}));
vi.mock("@/lib/render/renderVideo", () => ({
  renderEjectionVideo: (...args: unknown[]) => renderEjectionVideo(...args),
}));
vi.mock("@/lib/render/download", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/render/download")>();
  return {
    ...original,
    downloadBlob: (...args: unknown[]) => downloadBlob(...args),
  };
});

import { DownloadSection } from "./DownloadSection";

const props: EjectorProps = {
  ejectedText: "Red was ejected",
  impostorText: "1 Impostor remains",
  characterFrames: staticCharacterFrames(DEFAULT_CHARACTER_URL),
  showWatermark: false,
};

function PreSeededPaid({ children }: { children: React.ReactNode }) {
  const { markPaid } = usePayment();
  useEffect(() => {
    markPaid(5);
  }, [markPaid]);
  return <>{children}</>;
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("ejector-payment-code", "payment-code");
  checkRenderSupport
    .mockReset()
    .mockResolvedValue({ supported: true, reason: null });
  renderEjectionVideo.mockReset().mockResolvedValue(renderedBlob);
  downloadBlob.mockReset();
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(DELIVERY_ID);
  vi.spyOn(tracking, "trackEvent").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DownloadSection paid delivery boundary", () => {
  it("uploads the exact rendered Blob and downloads only after email acceptance", async () => {
    const requestOrder: string[] = [];
    const deliveryIds: string[] = [];
    let providerAccepted = false;
    downloadBlob.mockImplementation(() => {
      expect(providerAccepted).toBe(true);
    });
    server.use(
      http.get("*/payment/ejector/:code/paid", () =>
        HttpResponse.json({ paid: false }),
      ),
      http.post(
        "http://payment-api.test/payment/ejector/:code/deliveries",
        async ({ params, request }) => {
          requestOrder.push("initialize");
          expect(params.code).toBe("payment-code");
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toEqual({
            deliveryId: DELIVERY_ID,
            tier: "full-hd",
            contentLength: VIDEO_BYTES.byteLength,
            checksum: CHECKSUM,
            contentType: "video/mp4",
          });
          expect(body).not.toHaveProperty("email");
          deliveryIds.push(body.deliveryId as string);
          return HttpResponse.json(
            {
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
            },
            { status: 201 },
          );
        },
      ),
      http.put(UPLOAD_URL, async ({ request }) => {
        requestOrder.push("upload");
        expect(request.headers.get("content-type")).toBe("video/mp4");
        expect(request.headers.get("x-amz-checksum-sha256")).toBe(CHECKSUM);
        expect(request.headers.get("x-amz-meta-delivery")).toBe(DELIVERY_ID);
        expect(
          Array.from(new Uint8Array(await request.arrayBuffer())),
        ).toEqual(Array.from(VIDEO_BYTES));
        return new HttpResponse(null, { status: 200 });
      }),
      http.post(
        "http://payment-api.test/payment/ejector/:code/deliveries/:deliveryId/complete",
        ({ params }) => {
          requestOrder.push("complete");
          deliveryIds.push(params.deliveryId as string);
          return HttpResponse.json({
            deliveryId: DELIVERY_ID,
            status: "email_pending",
            downloadUrl: DOWNLOAD_URL,
            retryable: false,
          });
        },
      ),
      http.get(
        "http://payment-api.test/payment/ejector/:code/deliveries/:deliveryId",
        ({ params }) => {
          requestOrder.push("status");
          deliveryIds.push(params.deliveryId as string);
          providerAccepted = true;
          return HttpResponse.json({
            deliveryId: DELIVERY_ID,
            status: "email_accepted",
            downloadUrl: DOWNLOAD_URL,
            retryable: false,
          });
        },
      ),
    );
    render(
      <PaymentProvider>
        <PreSeededPaid>
          <DownloadSection props={props} />
        </PreSeededPaid>
      </PaymentProvider>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Download Video" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Your generation is being finished."),
      ).toBeVisible(),
    );
    expect(screen.queryByText(/uploading|emailing/i)).not.toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();

    await waitFor(
      () =>
        expect(requestOrder).toEqual([
          "initialize",
          "upload",
          "complete",
          "status",
        ]),
      { timeout: 3000 },
    );
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(deliveryIds).toEqual([
      DELIVERY_ID,
      DELIVERY_ID,
      DELIVERY_ID,
    ]);
    expect(renderEjectionVideo).toHaveBeenCalledTimes(1);
    expect(downloadBlob).toHaveBeenCalledWith(
      renderedBlob,
      "Red-was-ejected.mp4",
    );
    expect(
      window.localStorage.getItem("ejector-pending-delivery"),
    ).toBeNull();
  });
});
