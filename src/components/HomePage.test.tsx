import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider, useLocale, type Locale } from "@/lib/i18n";

// Player needs a real browser; stub it to a div capturing inputProps so we
// can assert the live preview reflects the form state.
vi.mock("@remotion/player", () => ({
  Player: (props: Record<string, unknown>) => (
    <div data-testid="player" data-props={JSON.stringify(props.inputProps)} />
  ),
}));

import { HomePage } from "./HomePage";

function playerInputProps() {
  const raw = screen.getByTestId("player").getAttribute("data-props");
  return JSON.parse(raw ?? "{}");
}

beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

// The locale store is a module-level singleton whose cache leaks across tests
// in this file, so each test primes it to a known baseline. Rendering a
// component that calls setLocale updates the same singleton HomePage reads.
function LocaleSetter({ target }: { target: Locale }) {
  const { setLocale } = useLocale();
  useEffect(() => {
    setLocale(target);
  }, [target, setLocale]);
  return null;
}

function primeLocale(target: Locale) {
  const view = render(
    <I18nProvider>
      <LocaleSetter target={target} />
    </I18nProvider>,
  );
  view.unmount();
}

beforeEach(() => {
  primeLocale("en");
});

function renderHome() {
  return render(
    <I18nProvider>
      <HomePage />
    </I18nProvider>,
  );
}

describe("HomePage", () => {
  it("renders both text inputs with their default values", () => {
    renderHome();
    expect(screen.getByLabelText("Ejection Text")).toHaveValue(
      "Red was not The Impostor",
    );
    expect(screen.getByLabelText("Impostor Remain text")).toHaveValue(
      "1 Impostor remains",
    );
  });

  it("seeds the live preview with the default composition props", () => {
    renderHome();
    expect(playerInputProps().ejectedText).toBe("Red was not The Impostor");
    expect(playerInputProps().impostorText).toBe("1 Impostor remains");
  });

  it("updates the player inputProps when the ejection text changes", async () => {
    const user = userEvent.setup();
    renderHome();
    const input = screen.getByLabelText("Ejection Text");
    await user.clear(input);
    await user.type(input, "Blue was ejected");
    expect(screen.getByLabelText("Ejection Text")).toHaveValue(
      "Blue was ejected",
    );
    expect(playerInputProps().ejectedText).toBe("Blue was ejected");
  });

  it("updates the player inputProps when the impostor text changes", async () => {
    const user = userEvent.setup();
    renderHome();
    const input = screen.getByLabelText("Impostor Remain text");
    await user.clear(input);
    await user.type(input, "2 Impostors remain");
    expect(playerInputProps().impostorText).toBe("2 Impostors remain");
  });

  it("seeds pt-BR defaults for a pt-BR visitor", async () => {
    window.localStorage.setItem("ejector-locale", "pt-BR");
    primeLocale("pt-BR");
    renderHome();
    expect(
      await screen.findByDisplayValue("Vermelho não era o Impostor"),
    ).toBeInTheDocument();
  });

  it("re-seeds the translated defaults when the locale switches before any edit", async () => {
    renderHome();
    expect(screen.getByLabelText("Ejection Text")).toHaveValue(
      "Red was not The Impostor",
    );
    await userEvent.click(screen.getByRole("button", { name: "PT-BR" }));
    expect(
      await screen.findByDisplayValue("Vermelho não era o Impostor"),
    ).toBeInTheDocument();
  });

  it("keeps user-typed text when the locale switches after an edit", async () => {
    const user = userEvent.setup();
    renderHome();
    const input = screen.getByLabelText("Ejection Text");
    await user.clear(input);
    await user.type(input, "Blue was ejected");
    await user.click(screen.getByRole("button", { name: "PT-BR" }));
    // The label localizes to pt-BR, but the user's text must survive the switch.
    expect(screen.getByDisplayValue("Blue was ejected")).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("Vermelho não era o Impostor"),
    ).not.toBeInTheDocument();
  });
});
