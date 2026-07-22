import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// public/llms.txt describes the product to AI crawlers. It repeats facts that
// live in code (prices, resolutions, the no-server-render guarantee), so these
// assertions exist to catch it going stale when those change.
const llmsTxt = readFileSync(join(process.cwd(), "public/llms.txt"), "utf8");

describe("llms.txt", () => {
  it("states both paid tiers with their resolutions", () => {
    expect(llmsTxt).toContain("$3");
    expect(llmsTxt).toContain("1280×720");
    expect(llmsTxt).toContain("$5");
    expect(llmsTxt).toContain("1920×1080");
  });

  it("states the free GIF tier and the 24 hour paid window", () => {
    expect(llmsTxt).toMatch(/\*\*Free\*\*: GIF download/);
    expect(llmsTxt).toContain("24 hours");
  });

  it("states that rendering happens in the browser", () => {
    expect(llmsTxt).toMatch(/no server-side renderer/i);
  });

  it("links only to policy URLs that resolve", () => {
    // kassellabs.io/help/privacy/ is a 404 — the live page is /privacy.
    expect(llmsTxt).not.toContain("kassellabs.io/help/privacy");
    expect(llmsTxt).toContain("https://kassellabs.io/privacy");
  });
});
