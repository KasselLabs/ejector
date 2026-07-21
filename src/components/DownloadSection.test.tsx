import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import type { EjectorProps } from "@/types";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";
import { PaymentProvider, usePayment } from "@/contexts/PaymentProvider";

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
});
