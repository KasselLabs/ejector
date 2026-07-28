import { test, expect } from "@playwright/test";

// Regression guard for the export pipeline. This is the ONLY test that runs a
// real render in a real browser — every other layer mocks @remotion/web-renderer
// because WebCodecs cannot run in jsdom. Two production bugs shipped past the
// mocked tests and were only caught by hand:
//   1. <Audio> from "remotion" is rejected by @remotion/web-renderer, which
//      threw while building the scaffold — no frame ever rendered.
//   2. Swapping a 1920x1080 PNG per frame made Chrome abort the rapid
//      img.decode() calls ("EncodingError: The source image cannot be
//      decoded."), so delayRender() never cleared, timed out after 28s and
//      retried forever.
// Both surfaced here as "no download, generic error dialog".
test("Download GIF renders in the browser and produces a file", async ({
  page,
}) => {
  await page.route("**/payment/ejector/**", (route) =>
    route.fulfill({ json: { paid: false } }),
  );

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (/EncodingError|delayRender|not supported in @remotion/.test(text)) {
      consoleErrors.push(text.slice(0, 200));
    }
  });

  await page.goto("/");
  const gifButton = page.getByRole("button", { name: "Download GIF" });
  await expect(gifButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await gifButton.click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.gif$/);

  // A stalled render leaves these breadcrumbs even when a file eventually
  // appears, so assert the pipeline stayed clean rather than just non-empty.
  expect(consoleErrors).toEqual([]);
});

// The paid deliverable shares the composition, so the same two bugs broke it —
// and unlike the GIF it also encodes the audio track, which is its own failure
// surface.
test("a paid user's Download Video renders an MP4", async ({ page }) => {
  test.setTimeout(180_000);

  let deliveryId = "";
  let checksum = "";
  let releaseAcceptedStatus!: () => void;
  const acceptedStatusGate = new Promise<void>((resolve) => {
    releaseAcceptedStatus = resolve;
  });
  const requestOrder: string[] = [];
  let downloadStarted = false;

  page.on("download", () => {
    downloadStarted = true;
  });

  await page.route("https://storage.test/ejector-video.mp4", async (route) => {
    const request = route.request();
    requestOrder.push("upload");
    expect(request.method()).toBe("PUT");
    expect(request.headers()["content-type"]).toBe("video/mp4");
    expect(request.headers()["x-amz-checksum-sha256"]).toBe(checksum);
    await route.fulfill({ status: 200 });
  });

  await page.route("**/payment/ejector/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname.endsWith("/paid")) {
      requestOrder.push("paid");
      await route.fulfill({ json: { paid: true, dollarValue: 5 } });
      return;
    }

    if (request.method() === "POST" && pathname.endsWith("/deliveries")) {
      requestOrder.push("initialize");
      const body = request.postDataJSON() as {
        deliveryId: string;
        tier: string;
        contentType: string;
        contentLength: number;
        checksum: string;
      };
      deliveryId = body.deliveryId;
      checksum = body.checksum;
      expect(body.tier).toBe("full-hd");
      expect(body.contentType).toBe("video/mp4");
      expect(body.contentLength).toBeGreaterThan(0);
      await route.fulfill({
        status: 201,
        json: {
          deliveryId,
          status: "created",
          downloadUrl: "https://downloads.test/ejector-video.mp4",
          uploadUrl: "https://storage.test/ejector-video.mp4",
          uploadHeaders: {
            "content-type": "video/mp4",
            "x-amz-checksum-sha256": checksum,
          },
          retryable: true,
        },
      });
      return;
    }

    if (
      request.method() === "POST" &&
      pathname.endsWith(`/${deliveryId}/complete`)
    ) {
      requestOrder.push("complete");
      await route.fulfill({
        json: {
          deliveryId,
          status: "email_pending",
          downloadUrl: "https://downloads.test/ejector-video.mp4",
          retryable: false,
        },
      });
      return;
    }

    if (
      request.method() === "GET" &&
      pathname.endsWith(`/${deliveryId}`)
    ) {
      requestOrder.push("status");
      await acceptedStatusGate;
      await route.fulfill({
        json: {
          deliveryId,
          status: "email_accepted",
          downloadUrl: "https://downloads.test/ejector-video.mp4",
          retryable: false,
        },
      });
      return;
    }

    await route.abort("failed");
  });

  await page.goto("/");
  const videoButton = page.getByRole("button", { name: "Download Video" });
  await expect(videoButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await videoButton.click();
  await expect.poll(() => requestOrder, { timeout: 150_000 }).toEqual([
    "paid",
    "initialize",
    "upload",
    "complete",
    "status",
  ]);
  expect(downloadStarted).toBe(false);
  releaseAcceptedStatus();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
});
