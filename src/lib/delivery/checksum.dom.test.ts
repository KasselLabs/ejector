import { describe, expect, it } from "vitest";
import { sha256Base64 } from "./checksum";

describe("sha256Base64", () => {
  it("returns the base64 SHA-256 of the exact Blob bytes", async () => {
    await expect(
      sha256Base64(new Blob(["abc"], { type: "video/mp4" })),
    ).resolves.toBe("ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");
  });

  it("hashes binary bytes without converting them to text", async () => {
    const bytes = new Uint8Array([0, 255, 128, 65]);

    await expect(
      sha256Base64(new Blob([bytes], { type: "video/mp4" })),
    ).resolves.toBe("NQewHmRCd6080Q2t1uM8uAEVHmLjy4maZ0Ce9wHWB5w=");
  });
});
