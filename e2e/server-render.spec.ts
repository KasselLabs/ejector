import { expect, test } from "@playwright/test";

test("a paid stock selection can send a server render and download it after reload", async ({
  page,
  context,
}) => {
  const downloadUrl = "https://downloads.test/ejection.mp4";
  const submissions: Record<string, unknown>[] = [];
  await page.route("**/payment/ejector/*/paid", (route) =>
    route.fulfill({ json: { paid: true, dollarValue: 3 } }),
  );
  await page.route("**/payment/ejector/*/render-jobs", (route) => {
    const input = route.request().postDataJSON() as Record<string, unknown>;
    submissions.push(input);
    return route.fulfill({ json: { id: input.id, status: "queued" } });
  });
  await page.route("**/payment/ejector/*/render-jobs/*", (route) =>
    route.fulfill({
      json: {
        id: submissions[0].id,
        status: "ready",
        downloadUrl,
        emailStatus: "sent",
      },
    }),
  );
  await context.route(downloadUrl, (route) =>
    route.fulfill({
      contentType: "video/mp4",
      headers: { "content-disposition": 'attachment; filename="ejection.mp4"' },
      body: Buffer.from("server video download"),
    }),
  );

  await page.goto("/?testServerRender=1");
  const renderButton = page.getByRole("button", { name: "Render on our server" });
  await expect(renderButton).toBeVisible();

  await page.getByLabel("Upload an Ejection Image Here").setInputFiles(
    "public/among-us-red-character-color-reduced.png",
  );
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(renderButton).toHaveCount(0);

  await page.getByRole("button", { name: "#6b2fbc" }).click();
  await expect(renderButton).toBeVisible();
  await page.getByLabel("Ejection Text").fill("Purple was ejected");
  await page.getByLabel("Impostor Remain text").fill("");
  expect(submissions).toEqual([]);
  await renderButton.click();
  await expect(page.getByRole("link", { name: "Download", exact: true }))
    .toHaveAttribute("href", downloadUrl);
  expect(submissions).toEqual([{
    id: expect.any(String),
    tier: "hd",
    color: "#6b2fbc",
    ejectedText: "Purple was ejected",
    impostorText: "",
  }]);

  await page.goto("/");
  await expect(renderButton).toHaveCount(0);
  const downloadLink = page.getByRole("link", { name: "Download", exact: true });
  await expect(downloadLink).toHaveAttribute("href", downloadUrl);
  expect(submissions).toHaveLength(1);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadLink.click(),
  ]);
  expect(download.suggestedFilename()).toBe("ejection.mp4");
});
