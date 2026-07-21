import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { PaymentProvider } from "@/contexts/PaymentProvider";
import { PaymentDialog } from "./PaymentDialog";

const ALLOWED_ORIGIN = "https://payment.kassellabs.io";

function renderDialog({
  onPaid = vi.fn(),
  onClose = vi.fn(),
}: { onPaid?: (tier: "hd" | "full-hd") => void; onClose?: () => void } = {}) {
  render(
    <PaymentProvider>
      <PaymentDialog open onClose={onClose} onPaid={onPaid} />
    </PaymentProvider>,
  );
  return { onPaid, onClose };
}

beforeEach(() => {
  server.use(
    http.get("*/payment/ejector/:code/paid", () =>
      HttpResponse.json({ paid: false }),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("PaymentDialog", () => {
  it("renders the payment iframe scoped to the ejector app with the client code", async () => {
    renderDialog();
    const iframe = await screen.findByTitle("Payment Form");
    const src = iframe.getAttribute("src") ?? "";
    expect(src).toContain("app=ejector");
    expect(src).toMatch(/code=[^&]+/);
  });

  it("mounts the iframe with the localStorage code (never null) immediately after open", async () => {
    // Seed a known code before mount; the provider must seed `code`
    // synchronously so the iframe never opens with code=null.
    window.localStorage.setItem(
      "ejector-payment-code",
      "11111111-2222-3333-4444-555555555555",
    );
    renderDialog();
    const iframe = await screen.findByTitle("Payment Form");
    const src = iframe.getAttribute("src") ?? "";
    expect(src).toContain("code=11111111-2222-3333-4444-555555555555");
    expect(src).not.toContain("code=null");
  });

  it("posts setAmount 3 (dollars) to the iframe origin when the HD card is selected", async () => {
    renderDialog();
    const iframe = (await screen.findByTitle(
      "Payment Form",
    )) as HTMLIFrameElement;
    const postMessage = vi.spyOn(
      iframe.contentWindow as Window,
      "postMessage",
    );

    await userEvent.click(screen.getByText("HD Video"));

    expect(postMessage).toHaveBeenCalledWith(
      { action: "setAmount", payload: 3 },
      ALLOWED_ORIGIN,
    );
  });

  it("marks paid and calls onPaid with the resolved tier on a success message, then closes", async () => {
    const { onPaid, onClose } = renderDialog();
    await screen.findByTitle("Payment Form");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "payment",
          action: "success",
          payload: {
            // finalAmount is DECIMAL DOLLARS (payment-frontend sends amount / 100).
            amount: 500,
            finalAmount: 5,
            currency: "usd",
            email: "a@b.com",
            method: "stripe",
          },
        },
        origin: ALLOWED_ORIGIN,
      }),
    );

    await waitFor(() => expect(onPaid).toHaveBeenCalledWith("full-hd"));
    expect(onClose).toHaveBeenCalled();
  });

  it("unlocks and closes when the paid status flips true while open", async () => {
    // Backend reports paid at the full-hd dollar value; the same fetch that the
    // 5s poll issues runs on mount, so the paid-flip effect must close the open
    // dialog and unlock with the resolved tier. (Real timers keep this
    // deterministic — fake timers fight MSW's async fetch resolution.)
    server.use(
      http.get("*/payment/ejector/:code/paid", () =>
        HttpResponse.json({ paid: true, dollarValue: 5 }),
      ),
    );
    const onPaid = vi.fn();
    const onClose = vi.fn();
    render(
      <PaymentProvider>
        <PaymentDialog open onClose={onClose} onPaid={onPaid} />
      </PaymentProvider>,
    );

    await waitFor(() => expect(onPaid).toHaveBeenCalledWith("full-hd"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render the dialog content when closed", () => {
    render(
      <PaymentProvider>
        <PaymentDialog open={false} onClose={() => {}} onPaid={() => {}} />
      </PaymentProvider>,
    );
    expect(screen.queryByTitle("Payment Form")).not.toBeInTheDocument();
  });
});
