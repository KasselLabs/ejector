import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { AboutSection } from "./AboutSection";

function renderAbout() {
  return render(
    <I18nProvider>
      <AboutSection />
    </I18nProvider>,
  );
}

describe("AboutSection", () => {
  it("renders the section heading", () => {
    renderAbout();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Make Your Own Ejection GIF or Video",
      }),
    ).toBeInTheDocument();
  });

  it("renders the supporting subheadings", () => {
    renderAbout();
    for (const name of ["How It Works", "Free GIF vs. Paid Video", "FAQ"]) {
      expect(
        screen.getByRole("heading", { level: 3, name }),
      ).toBeInTheDocument();
    }
  });

  it("renders the three FAQ questions", () => {
    renderAbout();
    expect(
      screen.getByText("Can I use any crewmate color?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Does this render on your servers?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Can I use this for streams or YouTube?"),
    ).toBeInTheDocument();
  });
});
