import { describe, expect, it, vi } from "vitest";
import { downloadPublicUrl } from "./downloadPublicUrl";

describe("downloadPublicUrl", () => {
  it("clicks and removes a temporary noopener download link", () => {
    const appendChild = vi.spyOn(document.body, "appendChild");
    const remove = vi
      .spyOn(HTMLAnchorElement.prototype, "remove")
      .mockImplementation(() => {});
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
  });
});
