import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import type { EjectorProps } from "@/types";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";
import { PaymentProvider, usePayment } from "@/contexts/PaymentProvider";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_PAYMENT_API_URL", "http://payment-api.test");
});

const checkRenderSupport = vi.fn();
const renderEjectionGif = vi.fn();
const renderEjectionVideo = vi.fn();
const downloadBlob = vi.fn();

vi.mock("@/lib/render/capability", () => ({
  checkRenderSupport: (...args: unknown[]) => checkRenderSupport(...args),
}));
vi.mock("@/lib/render/renderGif", () => ({
  renderEjectionGif: (...args: unknown[]) => renderEjectionGif(...args),
}));
vi.mock("@/lib/render/renderVideo", () => ({
  renderEjectionVideo: (...args: unknown[]) => renderEjectionVideo(...args),
}));
vi.mock("@/lib/render/download", () => ({
  downloadBlob: (...args: unknown[]) => downloadBlob(...args),
  ejectionFilename: (text: string, ext: string) =>
    `${text.replace(/\s+/g, "-")}.${ext}`,
}));

import { DownloadSection } from "./DownloadSection";

const props: EjectorProps = {
  ejectedText: "Red was ejected",
  impostorText: "1 Impostor remains",
  characterFrames: staticCharacterFrames(DEFAULT_CHARACTER_URL),
  showWatermark: false,
};

// Seeds the payment context to "paid" via the real markPaid path, rather
// than mocking usePayment, so DownloadSection is exercised against the
// real PaymentProvider contract.
function PreSeededPaid({ children }: { children: React.ReactNode }) {
  const { markPaid } = usePayment();
  useEffect(() => {
    markPaid(5);
  }, [markPaid]);
  return <>{children}</>;
}

beforeEach(() => {
  window.localStorage.setItem("ejector-payment-code", "payment-code");
  checkRenderSupport
    .mockReset()
    .mockResolvedValue({ supported: true, reason: null });
  renderEjectionGif.mockReset().mockResolvedValue(new Blob(["x"]));
  renderEjectionVideo.mockReset().mockResolvedValue(new Blob(["x"]));
  downloadBlob.mockReset();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  server.use(
    http.get("*/payment/ejector/:code/paid", () =>
      HttpResponse.json({ paid: false }),
    ),
    http.post(
      "*/payment/ejector/:code/deliveries",
      async ({ request }) => {
        const { deliveryId } = (await request.json()) as {
          deliveryId: string;
        };
        return HttpResponse.json({
          deliveryId,
          status: "email_accepted",
          downloadUrl: "https://downloads.test/video.mp4",
          retryable: false,
        });
      },
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DownloadSection", () => {
  it("opens the payment dialog when downloading video while unpaid", async () => {
    render(
      <PaymentProvider>
        <DownloadSection props={props} />
      </PaymentProvider>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Download Video" }),
    );

    expect(await screen.findByTitle("Payment Form")).toBeInTheDocument();
    expect(renderEjectionVideo).not.toHaveBeenCalled();
  });

  it("downloads the gif directly without requiring payment", async () => {
    render(
      <PaymentProvider>
        <DownloadSection props={props} />
      </PaymentProvider>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Download GIF" }),
    );

    await waitFor(() => expect(renderEjectionGif).toHaveBeenCalledTimes(1));
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "Red-was-ejected.gif",
    );
    expect(screen.queryByTitle("Payment Form")).not.toBeInTheDocument();
  });

  it("renders the video directly, skipping the dialog, when already paid", async () => {
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
      expect(renderEjectionVideo).toHaveBeenCalledTimes(1),
    );
    expect(renderEjectionVideo).toHaveBeenCalledWith(
      expect.objectContaining({ props, tier: "full-hd" }),
    );
    expect(screen.queryByTitle("Payment Form")).not.toBeInTheDocument();
  });

  it("shows only generic finishing copy while paid delivery is pending", async () => {
    let finishInitialization!: () => void;
    server.use(
      http.post(
        "*/payment/ejector/:code/deliveries",
        async ({ request }) => {
          const { deliveryId } = (await request.json()) as {
            deliveryId: string;
          };
          await new Promise<void>((resolve) => {
            finishInitialization = resolve;
          });
          return HttpResponse.json({
            deliveryId,
            status: "email_accepted",
            downloadUrl: "https://downloads.test/video.mp4",
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

    expect(
      await screen.findByText("Your generation is being finished."),
    ).toBeVisible();
    expect(screen.queryByText(/uploading|emailing/i)).not.toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();

    await act(async () => {
      finishInitialization();
    });
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
  });

  it("offers manual delivery retry and does not rerender the MP4", async () => {
    const deliveryIds: string[] = [];
    let initializationCount = 0;
    server.use(
      http.post(
        "*/payment/ejector/:code/deliveries",
        async ({ request, params }) => {
          expect(params.code).toBe("payment-code");
          const { deliveryId } = (await request.json()) as {
            deliveryId: string;
          };
          deliveryIds.push(deliveryId);
          initializationCount += 1;
          if (initializationCount === 1) {
            return HttpResponse.json({
              deliveryId,
              status: "failed",
              downloadUrl: "https://downloads.test/video.mp4",
              retryable: true,
              error: { message: "temporary failure" },
            });
          }
          return HttpResponse.json({
            deliveryId,
            status: "email_accepted",
            downloadUrl: "https://downloads.test/video.mp4",
            retryable: false,
          });
        },
      ),
      http.post(
        "*/payment/ejector/:code/deliveries/:deliveryId/retry",
        ({ params }) =>
          HttpResponse.json({
            deliveryId: params.deliveryId,
            status: "failed",
            downloadUrl: "https://downloads.test/video.mp4",
            retryable: true,
            error: { message: "temporary failure" },
          }),
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
    expect(
      await screen.findByText("We couldn't finish delivering your video."),
    ).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: "Retry delivery" }),
    );

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(renderEjectionVideo).toHaveBeenCalledTimes(1);
    expect(deliveryIds).toHaveLength(2);
    expect(deliveryIds[1]).toBe(deliveryIds[0]);
  });

  it("does not expose retained delivery retry on an unsupported-browser error", async () => {
    let retryRequestCount = 0;
    server.use(
      http.post(
        "*/payment/ejector/:code/deliveries",
        async ({ request }) => {
          const { deliveryId } = (await request.json()) as {
            deliveryId: string;
          };
          return HttpResponse.json({
            deliveryId,
            status: "failed",
            downloadUrl: "https://downloads.test/video.mp4",
            retryable: true,
            error: { message: "temporary failure" },
          });
        },
      ),
      http.post(
        "*/payment/ejector/:code/deliveries/:deliveryId/retry",
        ({ params }) => {
          retryRequestCount += 1;
          return HttpResponse.json({
            deliveryId: params.deliveryId,
            status: "failed",
            downloadUrl: "https://downloads.test/video.mp4",
            retryable: true,
            error: { message: "temporary failure" },
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
    expect(
      await screen.findByRole("button", { name: "Retry delivery" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Retry delivery" }),
      ).not.toBeInTheDocument(),
    );

    checkRenderSupport.mockResolvedValue({
      supported: false,
      reason: "no webcodecs",
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Download Video" }),
    );

    expect(
      await screen.findByText(
        "Video export needs a Chromium-based browser (Chrome, Edge, Brave) or recent Safari. The preview still works everywhere.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Retry delivery" }),
    ).not.toBeInTheDocument();
    expect(retryRequestCount).toBe(1);
  });
});
