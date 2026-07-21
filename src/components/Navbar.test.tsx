import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    priority?: boolean;
    // eslint-disable-next-line @next/next/no-img-element -- test mock of next/image
  }) => <img src={src} alt={alt} {...props} />,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { Navbar } from "./Navbar";
import { OTHER_INTRO_CREATORS } from "@/lib/introCreators";

describe("Navbar", () => {
  it("renders the Kassel Labs logo with accessible label", () => {
    render(<Navbar />);
    expect(
      screen.getByRole("link", { name: /kassel labs/i }),
    ).toBeInTheDocument();
  });

  it("renders the HOME nav link pointing to /", () => {
    render(<Navbar />);
    // getAllByText: JSDOM may suppress list-role links when list-style:none.
    const homeLinks = screen.getAllByText("HOME");
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    expect(homeLinks[0].closest("a")).toHaveAttribute("href", "/");
  });

  it("marks the HOME link as active (aria-current=page) when pathname is /", () => {
    render(<Navbar />);
    const homeLinks = screen.getAllByText("HOME");
    expect(homeLinks[0].closest("a")).toHaveAttribute("aria-current", "page");
  });

  it("renders the CONTACT and MORE APPS nav items", () => {
    render(<Navbar />);
    expect(screen.getAllByText("CONTACT").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MORE APPS").length).toBeGreaterThanOrEqual(1);
  });

  it("points HELP/CONTACT at this app's help URL (among-us-ejector)", () => {
    render(<Navbar />);
    const contact = screen.getAllByText("CONTACT")[0].closest("a");
    expect(contact).toHaveAttribute(
      "href",
      "https://kassellabs.io/help/among-us-ejector/",
    );
  });

  it("lists the other intro creators under MORE APPS, each linking out", () => {
    render(<Navbar />);
    for (const creator of OTHER_INTRO_CREATORS) {
      const items = screen.getAllByText(creator.label);
      expect(items.length).toBeGreaterThanOrEqual(1);
      const link = items[0].closest("a");
      expect(link).toHaveAttribute("href", creator.href);
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("opens the mobile menu when the hamburger button is clicked", async () => {
    render(<Navbar />);
    const hamburger = screen.getByRole("button", { name: /toggle menu/i });
    expect(hamburger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByText("HOME").length).toBe(1);
    await userEvent.click(hamburger);
    expect(hamburger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("HOME").length).toBeGreaterThanOrEqual(2);
  });

  it("closes the mobile menu when a menu item is clicked", async () => {
    render(<Navbar />);
    const hamburger = screen.getByRole("button", { name: /toggle menu/i });
    await userEvent.click(hamburger);
    const homeItemsOpen = screen.getAllByText("HOME");
    expect(homeItemsOpen.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(homeItemsOpen[homeItemsOpen.length - 1]);
    expect(screen.getAllByText("HOME").length).toBe(1);
  });
});
