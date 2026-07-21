import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { I18nProvider } from "@/lib/i18n";
import { SubscribeForm } from "./SubscribeForm";

function renderForm() {
  return render(
    <I18nProvider>
      <SubscribeForm />
    </I18nProvider>,
  );
}

describe("SubscribeForm", () => {
  it("renders the choose-your-map panel and email form", () => {
    renderForm();
    expect(screen.getByText("Choose your map")).toBeInTheDocument();
    expect(screen.getByLabelText("Your Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Notify Me" }),
    ).toBeInTheDocument();
  });

  it("shows the thank-you toast on successful subscription", async () => {
    server.use(
      http.post("*/graphql", () =>
        HttpResponse.json({ data: { subscribeNewsletter: { id: "1" } } }),
      ),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Your Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Notify Me" }));

    expect(
      await screen.findByText(
        "Thanks! We'll notify you as soon as it is ready! 🚀",
      ),
    ).toBeInTheDocument();
    // The form stays usable after a successful subscribe.
    expect(
      screen.getByRole("button", { name: "Notify Me" }),
    ).toBeInTheDocument();
  });

  it("shows an inline error message when the request fails", async () => {
    server.use(
      http.post("*/graphql", () =>
        HttpResponse.json({ errors: [{ message: "boom" }] }),
      ),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Your Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Notify Me" }));

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
    // The form is still usable after a failure.
    expect(
      screen.getByRole("button", { name: "Notify Me" }),
    ).toBeInTheDocument();
  });

  it("disables the submit button while the request is in flight", async () => {
    server.use(
      http.post(
        "*/graphql",
        async () =>
          new Promise(() => {
            // never resolves during this test
          }),
      ),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Your Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Notify Me" }));

    expect(
      screen.getByRole("button", { name: "Loading" }),
    ).toBeDisabled();
  });
});
