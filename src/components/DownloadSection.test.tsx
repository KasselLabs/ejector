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
const renderJobKey = "ejector-render-job:payment-code";
const renderJobId = "a4fcf746-6957-447f-9c14-f4c48fd72186";
const serverVideo = "https://downloads.test/server-video.mp4";

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
  window.localStorage.removeItem("ejector-pending-delivery");
  window.localStorage.removeItem(renderJobKey);
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
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("paid server rendering", () => {
  function renderPaid(stockColor: string | null, currentProps = props) {
    return render(
      <PaymentProvider>
        <PreSeededPaid>
          <DownloadSection props={currentProps} stockColor={stockColor} />
        </PreSeededPaid>
      </PaymentProvider>,
    );
  }

  it("requires consent after a paid browser encode failure and sends only the stock color and text", async () => {
    const submissions: unknown[] = [];
    renderEjectionVideo.mockRejectedValue(new Error("Encoder failed"));
    server.use(
      http.post("*/payment/ejector/:code/render-jobs", async ({ request, params }) => {
        expect(params.code).toBe("payment-code");
        const input = (await request.json()) as { id: string };
        submissions.push(input);
        return HttpResponse.json({ id: input.id, status: "queued" });
      }),
      http.get("*/payment/ejector/:code/render-jobs/:id", ({ params }) =>
        HttpResponse.json({
          id: params.id,
          status: "ready",
          downloadUrl: serverVideo,
          emailStatus: "sent",
        }),
      ),
    );
    renderPaid("#6b2fbc", { ...props, impostorText: "" });

    await userEvent.click(screen.getByRole("button", { name: "Download Video" }));
    expect(await screen.findByText(/send your.*text and.*color/i)).toBeVisible();
    expect(submissions).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Render on our server" }));

    const download = await screen.findByRole("link", { name: "Download" }, { timeout: 3500 });
    expect(download).toHaveAttribute("href", serverVideo);
    expect(screen.getByText(/sent.*payment email/i)).toBeVisible();
    expect(submissions).toEqual([{
      id: expect.stringMatching(/^[\da-f-]{36}$/i),
      tier: "full-hd",
      color: "#6b2fbc",
      ejectedText: "Red was ejected",
      impostorText: "",
    }]);
    expect(window.localStorage.getItem(renderJobKey)).toBe(
      (submissions[0] as { id: string }).id,
    );
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("offers the same opt-in when the browser cannot render", async () => {
    checkRenderSupport.mockResolvedValue({ supported: false, reason: "No WebCodecs" });
    renderPaid("#d1211d");

    await userEvent.click(screen.getByRole("button", { name: "Download Video" }));

    expect(await screen.findByRole("button", { name: "Render on our server" })).toBeVisible();
    expect(renderEjectionVideo).not.toHaveBeenCalled();
  });

  it("keeps custom-character MP4 and free GIF failures on the browser path", async () => {
    const user = userEvent.setup();
    checkRenderSupport.mockResolvedValue({ supported: false, reason: "No WebCodecs" });
    renderPaid(null);

    await user.click(screen.getByRole("button", { name: "Download Video" }));
    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Render on our server" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Download GIF" }));

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Render on our server" })).toBeNull();
  });

  it("keeps a paid stock upload failure on the existing delivery retry path", async () => {
    server.use(
      http.post("*/payment/ejector/:code/deliveries", async ({ request }) => {
        const { deliveryId } = (await request.json()) as { deliveryId: string };
        return HttpResponse.json({
          deliveryId,
          status: "failed",
          downloadUrl: serverVideo,
          retryable: true,
          error: { message: "temporary failure" },
        });
      }),
      http.post("*/payment/ejector/:code/deliveries/:deliveryId/retry", ({ params }) =>
        HttpResponse.json({
          deliveryId: params.deliveryId,
          status: "failed",
          downloadUrl: serverVideo,
          retryable: true,
          error: { message: "temporary failure" },
        }),
      ),
    );
    renderPaid("#d1211d");

    await userEvent.click(screen.getByRole("button", { name: "Download Video" }));

    expect(await screen.findByRole("button", { name: "Retry delivery" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Render on our server" })).toBeNull();
  });

  it("recovers the code's ready job after a reload and keeps the download when email failed", async () => {
    window.localStorage.setItem(renderJobKey, renderJobId);
    server.use(
      http.get("*/payment/ejector/:code/render-jobs/:id", ({ params }) => {
        expect(params.code).toBe("payment-code");
        expect(params.id).toBe(renderJobId);
        return HttpResponse.json({
          id: renderJobId,
          status: "ready",
          downloadUrl: serverVideo,
          emailStatus: "failed",
        });
      }),
    );
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click");
    renderPaid("#d1211d");

    expect(await screen.findByRole("link", { name: "Download" })).toHaveAttribute("href", serverVideo);
    expect(screen.getByText(/email delivery failed/i)).toBeVisible();
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it("updates the ready video's email notice after acceptance", async () => {
    window.localStorage.setItem(renderJobKey, renderJobId);
    let checks = 0;
    server.use(
      http.get("*/payment/ejector/:code/render-jobs/:id", ({ params }) =>
        HttpResponse.json({
          id: params.id,
          status: "ready",
          downloadUrl: serverVideo,
          emailStatus: ++checks === 1 ? "pending" : "sent",
        }),
      ),
    );
    renderPaid("#d1211d");

    const download = await screen.findByRole("link", { name: "Download" });
    expect(screen.getByText(/preparing the email/i)).toBeVisible();
    expect(await screen.findByText(/sent.*payment email/i, {}, { timeout: 3500 }))
      .toBeVisible();
    expect(download).toHaveAttribute("href", serverVideo);
  });

  it("keeps a verified download if the server can no longer verify email", async () => {
    window.localStorage.setItem(renderJobKey, renderJobId);
    let checks = 0;
    server.use(
      http.get("*/payment/ejector/:code/render-jobs/:id", ({ params }) => {
        if (++checks > 1) return new HttpResponse(null, { status: 403 });
        return HttpResponse.json({
          id: params.id,
          status: "ready",
          downloadUrl: serverVideo,
          emailStatus: "pending",
        });
      }),
    );
    renderPaid("#d1211d");

    expect(await screen.findByText(/couldn't confirm.*email/i, {}, { timeout: 3500 }))
      .toBeVisible();
    expect(screen.getByRole("link", { name: "Download" }))
      .toHaveAttribute("href", serverVideo);
    expect(screen.queryByText(/preparing the email/i)).toBeNull();
    expect(window.localStorage.getItem(renderJobKey)).toBe(renderJobId);
  });

  it("keeps the verified link and ends the pending email notice after the polling deadline", async () => {
    vi.useFakeTimers();
    try {
      window.localStorage.setItem(renderJobKey, renderJobId);
      let checks = 0;
      server.use(
        http.get("*/payment/ejector/:code/render-jobs/:id", ({ params }) => {
          if (++checks > 1) return HttpResponse.error();
          return HttpResponse.json({
            id: params.id,
            status: "ready",
            downloadUrl: serverVideo,
            emailStatus: "pending",
          });
        }),
      );
      renderPaid("#d1211d");

      await vi.waitFor(() => expect(screen.getByText(/preparing the email/i)).toBeVisible());
      await act(async () => await vi.advanceTimersByTimeAsync(15_000));
      expect(checks).toBeGreaterThan(5);
      expect(screen.getByRole("link", { name: "Download" }))
        .toHaveAttribute("href", serverVideo);
      await act(async () => await vi.advanceTimersByTimeAsync(180_000));

      expect(screen.getByText(/couldn't confirm.*email/i)).toBeVisible();
      expect(screen.getByRole("link", { name: "Download" }))
        .toHaveAttribute("href", serverVideo);
      expect(screen.queryByText(/preparing the email/i)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("can start a new server render while an earlier video's email is pending", async () => {
    window.history.replaceState(null, "", "/?testServerRender=1");
    window.localStorage.setItem(renderJobKey, renderJobId);
    const nextVideo = "https://downloads.test/next-video.mp4";
    server.use(
      http.get("*/payment/ejector/:code/render-jobs/:id", ({ params }) =>
        HttpResponse.json({
          id: params.id,
          status: "ready",
          downloadUrl: serverVideo,
          emailStatus: "pending",
        }),
      ),
      http.post("*/payment/ejector/:code/render-jobs", async ({ request }) => {
        const { id } = (await request.json()) as { id: string };
        expect(id).not.toBe(renderJobId);
        return HttpResponse.json({
          id,
          status: "ready",
          downloadUrl: nextVideo,
          emailStatus: "sent",
        });
      }),
    );
    renderPaid("#d1211d");

    expect(await screen.findByText(/preparing the email/i)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Render on our server" }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Download" }))
        .toHaveAttribute("href", nextVideo),
    );
  });

  it("waits for enqueue acknowledgement before writing a shared resume UUID", async () => {
    window.history.replaceState(null, "", "/?testServerRender=1");
    let attemptedId: string | undefined;
    let rejectSubmission!: () => void;
    server.use(
      http.post("*/payment/ejector/:code/render-jobs", async ({ request }) => {
        const { id } = (await request.json()) as { id: string };
        attemptedId = id;
        await new Promise<void>((resolve) => {
          rejectSubmission = resolve;
        });
        return new HttpResponse(null, { status: 409 });
      }),
    );
    renderPaid("#d1211d");

    await userEvent.click(await screen.findByRole("button", { name: "Render on our server" }));
    await waitFor(() => expect(attemptedId).toBeDefined());
    expect(window.localStorage.getItem(renderJobKey)).toBeNull();
    // Another tab records the job it successfully enqueued before this POST was rejected.
    window.localStorage.setItem(renderJobKey, renderJobId);
    rejectSubmission();

    expect(await screen.findByText("This server render is unavailable.")).toBeVisible();
    expect(window.localStorage.getItem(renderJobKey)).toBe(renderJobId);
  });

  it("reuses a UUID after a transport failure and uses a fresh UUID only after confirmed job failure", async () => {
    window.history.replaceState(null, "", "/?testServerRender=1");
    const submittedIds: string[] = [];
    server.use(
      http.post("*/payment/ejector/:code/render-jobs", async ({ request }) => {
        const { id } = (await request.json()) as { id: string };
        submittedIds.push(id);
        if (submittedIds.length === 1) return HttpResponse.error();
        if (submittedIds.length === 2) return HttpResponse.json({ id, status: "failed" });
        return HttpResponse.json({
          id,
          status: "ready",
          downloadUrl: serverVideo,
          emailStatus: "pending",
        });
      }),
    );
    renderPaid("#d1211d");

    const start = await screen.findByRole("button", { name: "Render on our server" });
    expect(submittedIds).toEqual([]);
    await userEvent.click(start);
    const retry = await screen.findByRole("button", { name: "Render again on our server" }, { timeout: 3000 });
    expect(submittedIds).toEqual([expect.any(String), submittedIds[0]]);
    await userEvent.click(retry);

    expect(await screen.findByRole("link", { name: "Download" })).toBeVisible();
    expect(screen.getByText(/preparing the email/i)).toBeVisible();
    expect(submittedIds).toHaveLength(3);
    expect(submittedIds[2]).not.toBe(submittedIds[0]);
    expect(renderEjectionVideo).not.toHaveBeenCalled();
  });

  it("keeps the test opt-in hidden when unpaid, using a custom image, or outside the text limits", () => {
    window.history.replaceState(null, "", "/?testServerRender=1");
    const view = render(
      <PaymentProvider>
        <DownloadSection props={props} stockColor="#d1211d" />
      </PaymentProvider>,
    );
    expect(screen.queryByRole("button", { name: "Render on our server" })).toBeNull();
    view.unmount();

    const custom = renderPaid(null);
    expect(screen.queryByRole("button", { name: "Render on our server" })).toBeNull();
    custom.unmount();

    renderPaid("#d1211d", { ...props, ejectedText: "x".repeat(301) });
    expect(screen.queryByRole("button", { name: "Render on our server" })).toBeNull();
  });

  it("allows a paid stock render with both captions blank", async () => {
    window.history.replaceState(null, "", "/?testServerRender=1");
    renderPaid("#d1211d", { ...props, ejectedText: "", impostorText: "" });

    expect(screen.getByRole("button", { name: "Render on our server" })).toBeVisible();
  });
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
