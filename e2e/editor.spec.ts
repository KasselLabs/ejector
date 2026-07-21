import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/payment/ejector/**", (route) =>
    route.fulfill({ json: { paid: false } }),
  );
});

test("editor renders preview and editable texts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Ejection Text")).toHaveValue(
    "Red was not The Impostor",
  );
  await page.getByLabel("Ejection Text").fill("Blue was ejected");
  await expect(page.getByLabel("Ejection Text")).toHaveValue(
    "Blue was ejected",
  );
  // Remotion Player mounts
  await expect(page.locator(".__remotion-player")).toBeVisible();
});

test("character color swatches are present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("#d1211d")).toBeVisible();
});
