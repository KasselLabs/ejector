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
  await page.route("**/payment/ejector/**", (route) =>
    route.fulfill({ json: { paid: true, dollarValue: 5 } }),
  );

  await page.goto("/");
  const videoButton = page.getByRole("button", { name: "Download Video" });
  await expect(videoButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await videoButton.click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
});
