import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { ImageUrlField } from "./ImageUrlField";

// Stubs the global `Image` constructor the way `characterColor.dom.test.ts`
// / `cropImage.dom.test.ts` do: jsdom never actually decodes image bytes,
// so `onload`/`onerror` never fire on their own. `shouldFail` controls
// which handler the stub fires, asynchronously (matching real image
// loading, which is never synchronous).
function stubImage(shouldFail: boolean) {
  class MockImage {
    constructor() {
      const img = document.createElement("img");
      Object.defineProperty(img, "src", {
        configurable: true,
        set(value: string) {
          Object.defineProperty(img, "src", { configurable: true, value });
          queueMicrotask(() => {
            if (shouldFail) {
              img.onerror?.(new Event("error"));
            } else {
              img.onload?.(new Event("load"));
            }
          });
        },
      });
      return img;
    }
  }
  vi.stubGlobal("Image", MockImage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImageUrlField", () => {
  it("shows Invalid URL when the image fails to load and the proxy 404s", async () => {
    stubImage(true);
    server.use(
      http.get("https://cors.kassellabs.io/*", () =>
        HttpResponse.text("not found", { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    render(<ImageUrlField onChange={() => {}} />);

    await user.type(
      screen.getByPlaceholderText("Or Paste a Image URL here"),
      "https://example.com/broken.png",
    );

    expect(
      await screen.findByText("Invalid URL", {}, { timeout: 1000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the crop dialog for a valid, loadable, CORS-fetchable URL", async () => {
    stubImage(false);
    server.use(
      http.get("https://cors.kassellabs.io/*", () =>
        HttpResponse.text("", {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      ),
    );
    const user = userEvent.setup();
    render(<ImageUrlField onChange={() => {}} />);

    await user.type(
      screen.getByPlaceholderText("Or Paste a Image URL here"),
      "https://example.com/valid.png",
    );

    expect(
      await screen.findByRole("dialog", {}, { timeout: 1000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Crop Image")).toBeInTheDocument();
    expect(screen.queryByText("Invalid URL")).not.toBeInTheDocument();
  });
});
