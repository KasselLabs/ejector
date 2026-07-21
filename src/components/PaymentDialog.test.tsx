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
});

describe("PaymentDialog", () => {
  it("renders the payment iframe scoped to the ejector app with the client code", async () => {
    renderDialog();
    const iframe = await screen.findByTitle("Payment Form");
    const src = iframe.getAttribute("src") ?? "";
    expect(src).toContain("app=ejector");
    expect(src).toMatch(/code=[^&]+/);
  });

  it("posts setAmount 300 to the iframe when the HD card is selected", async () => {
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
      { action: "setAmount", payload: 300 },
      "*",
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
            amount: 500,
            finalAmount: 500,
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

  it("does not render the dialog content when closed", () => {
    render(
      <PaymentProvider>
        <PaymentDialog open={false} onClose={() => {}} onPaid={() => {}} />
      </PaymentProvider>,
    );
    expect(screen.queryByTitle("Payment Form")).not.toBeInTheDocument();
  });
});
