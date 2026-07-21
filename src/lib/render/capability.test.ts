import { beforeEach, describe, expect, it, vi } from "vitest";

const canRenderMediaOnWeb = vi.fn();
vi.mock("@remotion/web-renderer", () => ({
  canRenderMediaOnWeb: (...args: unknown[]) => canRenderMediaOnWeb(...args),
}));

import { checkRenderSupport } from "./capability";

beforeEach(() => {
  canRenderMediaOnWeb.mockReset();
});

describe("checkRenderSupport", () => {
  it("reports supported when canRender is true", async () => {
    canRenderMediaOnWeb.mockResolvedValue({ canRender: true, issues: [] });
    const result = await checkRenderSupport();
    expect(result).toEqual({ supported: true, reason: null });
    const call = canRenderMediaOnWeb.mock.calls[0][0];
    expect(call.width).toBe(1920);
    expect(call.height).toBe(1080);
    expect(call.container).toBe("mp4");
  });

  it("collects error-severity issue messages into reason when unsupported", async () => {
    canRenderMediaOnWeb.mockResolvedValue({
      canRender: false,
      issues: [
        { severity: "error", message: "no webcodecs", type: "webcodecs-unavailable" },
      ],
    });
    const result = await checkRenderSupport();
    expect(result).toEqual({ supported: false, reason: "no webcodecs" });
  });

  it("falls back to a generic message when there are no error issues", async () => {
    canRenderMediaOnWeb.mockResolvedValue({
      canRender: false,
      issues: [{ severity: "warning", message: "slow device", type: "perf" }],
    });
    const result = await checkRenderSupport();
    expect(result.supported).toBe(false);
    expect(result.reason).toBe("Rendering is not supported in this browser");
  });

  it("reports unsupported with the error message when canRenderMediaOnWeb throws", async () => {
    canRenderMediaOnWeb.mockRejectedValue(new Error("boom"));
    const result = await checkRenderSupport();
    expect(result).toEqual({ supported: false, reason: "boom" });
  });

  it("reports a generic reason when the thrown value isn't an Error", async () => {
    canRenderMediaOnWeb.mockRejectedValue("boom");
    const result = await checkRenderSupport();
    expect(result).toEqual({ supported: false, reason: "Unknown error" });
  });
});
