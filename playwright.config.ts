import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // `next dev` reads `.env.local`, not `.env.test`. CI has no `.env.local`
    // (see ci.yml, which copies `.env.test` over it before `npm run e2e`);
    // locally, only seed it from `.env.test` when a developer hasn't already
    // got their own `.env.local` in place, so this never clobbers real env.
    command: process.env.CI
      ? "npm run dev"
      : "cp -n .env.test .env.local 2>/dev/null; npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
