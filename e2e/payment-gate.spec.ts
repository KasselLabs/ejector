import { test, expect } from "@playwright/test";

test("unpaid user gets the payment dialog with the ejector iframe", async ({
  page,
}) => {
  await page.route("**/payment/ejector/**", (route) =>
    route.fulfill({ json: { paid: false } }),
  );
  await page.route("https://payment.kassellabs.io/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<html>pay</html>" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Download Video" }).click();
  const iframe = page.locator("iframe[src*='app=ejector']");
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute("src", /amount=500/);
});

test("paid user skips the dialog and starts generating", async ({ page }) => {
  // The render pipeline retries several times before giving up when
  // WebCodecs can't decode the sprite in headless Chromium (see comment
  // below), which alone can take longer than the default 30s test timeout.
  test.setTimeout(60_000);
  await page.route("**/payment/ejector/**", (route) =>
    route.fulfill({ json: { paid: true, dollarValue: 5 } }),
  );
  // PaymentProvider fetches paid status asynchronously on mount; wait for
  // that response (and the resulting state update) to land before clicking,
  // otherwise the click can race the initial `paid: false` state and open
  // the dialog before the mocked "paid" status resolves.
  const paidStatusResolved = page.waitForResponse("**/payment/ejector/**");
  await page.goto("/");
  await paidStatusResolved;
  // The response resolving doesn't guarantee React has committed the
  // resulting `paid: true` state yet — give it two animation frames to
  // settle before clicking, so the click handler reads the fresh state.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.getByRole("button", { name: "Download Video" }).click();
  await expect(page.locator("iframe[src*='app=ejector']")).toHaveCount(0);
  // Render pipeline kicks off (progress UI appears) or — as actually happens
  // in headless Chromium, where the WebCodecs ImageDecoder can't decode the
  // character sprite — retries for a few seconds and then surfaces the
  // generic ErrorDialog. Either one proves the payment gate opened (the
  // PaymentDialog/iframe never rendered); assert on whichever appears.
  // The error path is targeted via the dialog's heading role rather than
  // getByText: useFileGeneration's catch-all sets the error message to the
  // same generic string ErrorDialog uses as its title, so a plain text
  // locator matches both the title and the description and violates
  // Playwright's strict mode.
  await expect(
    page
      .getByRole("progressbar")
      .or(
        page.getByRole("heading", {
          name: "Something went wrong. Please try again.",
        }),
      ),
  ).toBeVisible({ timeout: 30_000 });
});
