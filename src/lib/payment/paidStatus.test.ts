import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { fetchPaidStatus, tierForDollarValue } from "./paidStatus";

describe("fetchPaidStatus", () => {
  it("returns the backend payload", async () => {
    server.use(
      http.get("*/payment/ejector/CODE/paid", () =>
        HttpResponse.json({ paid: true, dollarValue: 5 }),
      ),
    );
    await expect(fetchPaidStatus("CODE")).resolves.toEqual({
      paid: true,
      dollarValue: 5,
    });
  });

  it("resolves {paid:false} on HTTP error", async () => {
    server.use(
      http.get("*/payment/ejector/CODE/paid", () =>
        HttpResponse.json({ error: "x" }, { status: 500 }),
      ),
    );
    await expect(fetchPaidStatus("CODE")).resolves.toEqual({ paid: false });
  });

  it("resolves {paid:false} on network failure", async () => {
    server.use(
      http.get("*/payment/ejector/CODE/paid", () => HttpResponse.error()),
    );
    await expect(fetchPaidStatus("CODE")).resolves.toEqual({ paid: false });
  });
});

describe("tiers", () => {
  it("maps dollar values", () => {
    expect(tierForDollarValue(3)).toBe("hd");
    expect(tierForDollarValue(5)).toBe("full-hd");
    expect(tierForDollarValue(undefined)).toBe("hd");
  });
});
