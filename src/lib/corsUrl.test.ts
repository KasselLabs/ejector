import { describe, expect, it } from "vitest";
import { getCorsUrl } from "./corsUrl";

describe("getCorsUrl", () => {
  it("proxies http(s) URLs", () => {
    expect(getCorsUrl("https://example.com/a.png")).toBe(
      "https://cors.kassellabs.io/https://example.com/a.png",
    );
  });
  it("passes through data URLs and relative paths", () => {
    expect(getCorsUrl("data:image/png;base64,xx")).toBe(
      "data:image/png;base64,xx",
    );
    expect(getCorsUrl("/red.png")).toBe("/red.png");
  });
});
