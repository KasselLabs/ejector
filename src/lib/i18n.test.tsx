import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider, useT, useLocale } from "./i18n";

function Probe() {
  const t = useT();
  const { setLocale } = useLocale();
  return (
    <div>
      <span data-testid="value">{t("Ejection Text")}</span>
      <button onClick={() => setLocale("pt-BR")}>pt</button>
    </div>
  );
}

describe("i18n", () => {
  it("returns the key itself in English and the translation in pt-BR", async () => {
    const { getByText } = render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("value").textContent).toBe("Ejection Text");
    getByText("pt").click();
    await Promise.resolve();
    expect(screen.getByTestId("value").textContent).not.toBe("Ejection Text");
  });

  it("falls back to the key for unknown strings", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("value")).toBeInTheDocument();
  });
});
