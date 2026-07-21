import { describe, expect, it } from "vitest";
import { getCorsUrl } from "./corsUrl";

describe("getCorsUrl", () => {
  it("routes http(s) URLs through the same-origin proxy, URL-encoded", () => {
    expect(getCorsUrl("https://example.com/a.png")).toBe(
      "/api/proxy-image?url=https%3A%2F%2Fexample.com%2Fa.png",
    );
    expect(getCorsUrl("http://example.com/a.gif?x=1")).toBe(
      "/api/proxy-image?url=http%3A%2F%2Fexample.com%2Fa.gif%3Fx%3D1",
    );
  });
  it("passes through data URLs and relative paths", () => {
    expect(getCorsUrl("data:image/png;base64,xx")).toBe(
      "data:image/png;base64,xx",
    );
    expect(getCorsUrl("/red.png")).toBe("/red.png");
  });
});
