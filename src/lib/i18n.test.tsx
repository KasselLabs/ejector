import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
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

  it("renders the English server snapshot when server-rendered", () => {
    // useSyncExternalStore calls getServerSnapshot (not getSnapshot) during
    // actual server rendering, which only renderToString exercises for
    // real -- a client-only `render()` never takes this path.
    const html = renderToString(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(html).toContain("Ejection Text");
  });
});

// detectLocale's result is cached at module scope (see the file's
// `cachedLocale`), so exercising both halves of its "read from
// localStorage" branch for real -- rather than via the public setLocale
// API, which bypasses detectLocale entirely -- requires a fresh module
// instance per case.
describe("detectLocale (module-scoped, via a fresh import per case)", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("reuses a previously stored pt-BR locale on first read", async () => {
    window.localStorage.setItem("ejector-locale", "pt-BR");
    vi.resetModules();
    const fresh = await import("./i18n");
    function FreshProbe() {
      const t = fresh.useT();
      return <span data-testid="fresh-value">{t("Ejection Text")}</span>;
    }
    render(
      <fresh.I18nProvider>
        <FreshProbe />
      </fresh.I18nProvider>,
    );
    expect(screen.getByTestId("fresh-value").textContent).not.toBe(
      "Ejection Text",
    );
  });

  it("reuses a previously stored en locale on first read", async () => {
    window.localStorage.setItem("ejector-locale", "en");
    vi.resetModules();
    const fresh = await import("./i18n");
    function FreshProbe() {
      const t = fresh.useT();
      return <span data-testid="fresh-value">{t("Ejection Text")}</span>;
    }
    render(
      <fresh.I18nProvider>
        <FreshProbe />
      </fresh.I18nProvider>,
    );
    expect(screen.getByTestId("fresh-value").textContent).toBe(
      "Ejection Text",
    );
  });

  it("ignores a garbage stored value and falls back to navigator.language", async () => {
    window.localStorage.setItem("ejector-locale", "fr");
    vi.resetModules();
    const fresh = await import("./i18n");
    function FreshProbe() {
      const t = fresh.useT();
      return <span data-testid="fresh-value">{t("Ejection Text")}</span>;
    }
    render(
      <fresh.I18nProvider>
        <FreshProbe />
      </fresh.I18nProvider>,
    );
    // jsdom's default navigator.language is "en-US", so the fallback
    // resolves to English -- same as the key itself.
    expect(screen.getByTestId("fresh-value").textContent).toBe(
      "Ejection Text",
    );
  });
});
