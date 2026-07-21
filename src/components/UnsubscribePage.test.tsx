import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { I18nProvider } from "@/lib/i18n";

// next/navigation's useSearchParams can't run standalone in jsdom (it relies
// on the Next.js router internals), so it is mocked directly per the task
// brief's sanctioned exception.
const useSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParams(),
}));

import { UnsubscribePage } from "./UnsubscribePage";

function renderPage(email: string | null) {
  useSearchParams.mockReturnValue(new URLSearchParams(email ? { email } : {}));
  return render(
    <I18nProvider>
      <UnsubscribePage />
    </I18nProvider>,
  );
}

describe("UnsubscribePage", () => {
  it("prefills the email input from the ?email= query param", () => {
    renderPage("test@example.com");
    expect(
      screen.getByLabelText("Your email", { exact: false }),
    ).toHaveValue("test@example.com");
  });

  it("renders an empty input when there is no ?email= query param", () => {
    renderPage(null);
    expect(
      screen.getByLabelText("Your email", { exact: false }),
    ).toHaveValue("");
  });

  it("shows a success message after unsubscribing", async () => {
    server.use(
      http.post("*/graphql", () =>
        HttpResponse.json({ data: { unsubscribeNewsletter: { id: "1" } } }),
      ),
    );
    const user = userEvent.setup();
    renderPage("test@example.com");

    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));

    expect(
      await screen.findByText("You have been unsubscribed"),
    ).toBeInTheDocument();
  });

  it("shows an inline error message when the request fails", async () => {
    server.use(
      http.post("*/graphql", () =>
        HttpResponse.json({ errors: [{ message: "boom" }] }),
      ),
    );
    const user = userEvent.setup();
    renderPage("test@example.com");

    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
  });
});
