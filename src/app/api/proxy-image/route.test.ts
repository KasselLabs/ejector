import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { GET } from "./route";

function proxyRequest(target: string): Request {
  return new Request(
    `http://localhost/api/proxy-image?url=${encodeURIComponent(target)}`,
  );
}

describe("GET /api/proxy-image", () => {
  it("proxies a valid upstream image with its content-type and cache header", async () => {
    server.use(
      http.get("https://example.com/a.png", () =>
        HttpResponse.arrayBuffer(new Uint8Array([1, 2, 3]).buffer, {
          headers: { "Content-Type": "image/png" },
        }),
      ),
    );

    const res = await GET(proxyRequest("https://example.com/a.png"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("returns 415 when the upstream response is not an image", async () => {
    server.use(
      http.get("https://example.com/page.html", () =>
        HttpResponse.text("<html></html>", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    const res = await GET(proxyRequest("https://example.com/page.html"));
    expect(res.status).toBe(415);
  });

  it("returns 413 when the upstream declares an oversized content-length", async () => {
    server.use(
      http.get("https://example.com/big.png", () =>
        HttpResponse.arrayBuffer(new Uint8Array([0]).buffer, {
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(20 * 1024 * 1024),
          },
        }),
      ),
    );

    const res = await GET(proxyRequest("https://example.com/big.png"));
    expect(res.status).toBe(413);
  });

  it("returns 400 for a private/reserved host (SSRF guard)", async () => {
    const res = await GET(proxyRequest("http://169.254.169.254/latest/meta"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-http(s) scheme", async () => {
    const res = await GET(proxyRequest("ftp://example.com/a.png"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the url parameter is missing", async () => {
    const res = await GET(new Request("http://localhost/api/proxy-image"));
    expect(res.status).toBe(400);
  });

  it("returns 502 when the upstream fetch fails", async () => {
    server.use(
      http.get("https://example.com/down.png", () => HttpResponse.error()),
    );

    const res = await GET(proxyRequest("https://example.com/down.png"));
    expect(res.status).toBe(502);
  });

  it("returns 502 when the upstream responds with a non-2xx status", async () => {
    server.use(
      http.get("https://example.com/missing.png", () =>
        HttpResponse.text("nope", { status: 404 }),
      ),
    );

    const res = await GET(proxyRequest("https://example.com/missing.png"));
    expect(res.status).toBe(502);
  });
});
