import { beforeEach, describe, expect, it } from "vitest";
import { getClientCode } from "./clientCode";

beforeEach(() => {
  window.localStorage.clear();
});

describe("getClientCode", () => {
  it("generates a UUID once and returns the same value on subsequent calls", () => {
    const first = getClientCode();
    const second = getClientCode();

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(second).toBe(first);
    expect(window.localStorage.getItem("ejector-payment-code")).toBe(first);
  });
});
