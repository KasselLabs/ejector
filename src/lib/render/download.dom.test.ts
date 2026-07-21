import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, ejectionFilename } from "./download";

describe("ejectionFilename", () => {
  it("replaces whitespace with dashes and appends the extension", () => {
    expect(ejectionFilename("Red was ejected", "gif")).toBe(
      "Red-was-ejected.gif",
    );
  });

  it("supports mp4", () => {
    expect(ejectionFilename("Blue was ejected", "mp4")).toBe(
      "Blue-was-ejected.mp4",
    );
  });
});

describe("downloadBlob", () => {
  const createObjectURL = vi.fn(() => "blob:mock-url");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an anchor pointing at the object URL, clicks it, and cleans up", () => {
    const blob = new Blob(["x"], { type: "video/mp4" });
    const appendSpy = vi.spyOn(document.body, "append");
    const createElementSpy = vi.spyOn(document, "createElement");
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    downloadBlob(blob, "Red-was-ejected.mp4");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    const anchor = createElementSpy.mock.results[0]?.value as HTMLAnchorElement;
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(anchor.href).toBe("blob:mock-url");
    expect(anchor.download).toBe("Red-was-ejected.mp4");
    expect(appendSpy).toHaveBeenCalledWith(anchor);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
