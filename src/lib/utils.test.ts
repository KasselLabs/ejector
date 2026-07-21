import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("text-sm", "font-bold")).toBe("text-sm font-bold");
  });

  it("resolves tailwind-merge conflicts by keeping the last one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("resolves conflicts across multiple conflicting utilities", () => {
    expect(cn("px-2 py-2", "px-4")).toBe("py-2 px-4");
  });

  it("includes classes from truthy conditionals and drops falsy ones", () => {
    expect(cn("base", true && "active", false && "hidden")).toBe(
      "base active",
    );
  });

  it("ignores null, undefined, and empty string inputs", () => {
    expect(cn("base", null, undefined, "")).toBe("base");
  });

  it("flattens arrays and objects supported by clsx", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });

  it("returns an empty string when given no meaningful input", () => {
    expect(cn()).toBe("");
    expect(cn(null, undefined, false)).toBe("");
  });
});
