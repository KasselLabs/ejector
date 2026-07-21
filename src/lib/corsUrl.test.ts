import { describe, expect, it } from "vitest";
import { getCorsUrl } from "./corsUrl";

describe("getCorsUrl", () => {
  it("routes http(s) URLs through the shared CORS proxy", () => {
    expect(getCorsUrl("https://example.com/a.png")).toBe(
      "https://cors.kassellabs.io/https://example.com/a.png",
    );
    expect(getCorsUrl("http://example.com/a.gif?x=1")).toBe(
      "https://cors.kassellabs.io/http://example.com/a.gif?x=1",
    );
  });
  it("passes through data URLs and relative paths", () => {
    expect(getCorsUrl("data:image/png;base64,xx")).toBe(
      "data:image/png;base64,xx",
    );
    expect(getCorsUrl("/red.png")).toBe("/red.png");
  });
});
