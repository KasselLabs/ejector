import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPublicUrl } from "./downloadPublicUrl";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("downloadPublicUrl", () => {
  it("clicks and removes a temporary noopener download link", () => {
    const appendChild = vi.spyOn(document.body, "appendChild");
    const remove = vi.spyOn(HTMLAnchorElement.prototype, "remove");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadPublicUrl(
      "https://downloads.test/unguessable/video.mp4",
      "Red-was-ejected.mp4",
    );

    expect(appendChild).toHaveBeenCalledTimes(1);
    const anchor = appendChild.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.href).toBe(
      "https://downloads.test/unguessable/video.mp4",
    );
    expect(anchor.download).toBe("Red-was-ejected.mp4");
    expect(anchor.rel).toBe("noopener");
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(document.body.contains(anchor)).toBe(false);
  });

  it.each([
    "javascript:alert(1)",
    "data:video/mp4;base64,AAAA",
    "/relative/video.mp4",
    "not a URL",
    "ftp://downloads.test/video.mp4",
    "https://user:password@downloads.test/video.mp4",
  ])("rejects an unsafe public download URL: %s", (url) => {
    const appendChild = vi.spyOn(document.body, "appendChild");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    expect(() =>
      downloadPublicUrl(url, "Red-was-ejected.mp4"),
    ).toThrow(TypeError);
    expect(appendChild).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it("removes the temporary link when clicking throws", () => {
    const appendChild = vi.spyOn(document.body, "appendChild");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("click failed");
    });

    expect(() =>
      downloadPublicUrl(
        "https://downloads.test/unguessable/video.mp4",
        "Red-was-ejected.mp4",
      ),
    ).toThrow("click failed");

    const anchor = appendChild.mock.calls[0][0] as HTMLAnchorElement;
    expect(document.body.contains(anchor)).toBe(false);
  });
});
