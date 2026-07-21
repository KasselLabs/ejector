import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { PaymentProvider, usePayment } from "./PaymentProvider";

function Probe() {
  const { paid, tier, markPaid, refresh } = usePayment();
  return (
    <div>
      <span data-testid="state">{`paid:${paid} tier:${tier}`}</span>
      <button onClick={() => markPaid(3)}>pay</button>
      <button onClick={() => void refresh()}>refresh</button>
    </div>
  );
}

describe("PaymentProvider", () => {
  it("restores a paid session from the backend", async () => {
    server.use(
      http.get("*/payment/ejector/:code/paid", () =>
        HttpResponse.json({ paid: true, dollarValue: 5 }),
      ),
    );
    render(
      <PaymentProvider>
        <Probe />
      </PaymentProvider>,
    );
    expect(
      await screen.findByText("paid:true tier:full-hd"),
    ).toBeInTheDocument();
  });

  it("markPaid unlocks immediately with the dollars-derived tier", async () => {
    server.use(
      http.get("*/payment/ejector/:code/paid", () =>
        HttpResponse.json({ paid: false }),
      ),
    );
    render(
      <PaymentProvider>
        <Probe />
      </PaymentProvider>,
    );
    await screen.findByText("paid:false tier:null");
    await userEvent.click(screen.getByText("pay"));
    expect(screen.getByText("paid:true tier:hd")).toBeInTheDocument();
  });

  it("refresh updates state when backend payment status changes", async () => {
    server.use(
      http.get("*/payment/ejector/:code/paid", () =>
        HttpResponse.json({ paid: false }),
      ),
    );
    render(
      <PaymentProvider>
        <Probe />
      </PaymentProvider>,
    );
    await screen.findByText("paid:false tier:null");

    // Swap the handler to return a paid status
    server.use(
      http.get("*/payment/ejector/:code/paid", () =>
        HttpResponse.json({ paid: true, dollarValue: 3 }),
      ),
    );

    // Call refresh to refetch and update state
    await userEvent.click(screen.getByText("refresh"));
    expect(
      await screen.findByText("paid:true tier:hd"),
    ).toBeInTheDocument();
  });
});
