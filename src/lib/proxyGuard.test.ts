import { describe, expect, it } from "vitest";
import { isBlockedHost } from "./proxyGuard";

describe("isBlockedHost", () => {
  it.each([
    "localhost",
    "api.localhost",
    "printer.local",
    "local",
    "127.0.0.1",
    "127.1.2.3",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "[::1]",
    "::",
  ])("blocks %s", (host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it.each([
    "example.com",
    "images.example.com",
    "cdn.kassellabs.io",
    "8.8.8.8",
    "1.2.3.4",
    "172.15.0.1", // just below the private 172.16-31 block
    "172.32.0.1", // just above it
    "192.169.0.1", // not 192.168
    "11.0.0.1",
  ])("allows %s", (host) => {
    expect(isBlockedHost(host)).toBe(false);
  });

  it("rejects out-of-range IPv4 octets as non-matching (not blocked)", () => {
    expect(isBlockedHost("999.999.999.999")).toBe(false);
  });

  it("ignores a trailing FQDN dot", () => {
    expect(isBlockedHost("localhost.")).toBe(true);
    expect(isBlockedHost("example.com.")).toBe(false);
  });
});
