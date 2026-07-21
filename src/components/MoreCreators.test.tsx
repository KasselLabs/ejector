import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoreCreators } from "./MoreCreators";
import {
  OTHER_INTRO_CREATORS,
  KASSEL_LABS_URL,
  type IntroCreatorLink,
} from "@/lib/introCreators";

describe("MoreCreators", () => {
  it("renders a link to every other intro creator, opening in a new tab safely", () => {
    render(<MoreCreators />);
    for (const creator of OTHER_INTRO_CREATORS) {
      const link = screen.getByRole("link", {
        name: new RegExp(creator.label, "i"),
      });
      expect(link).toHaveAttribute("href", creator.href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel") ?? "").toContain("noopener");
    }
  });

  it("orders the fallback creators as declared (Star Wars first)", () => {
    const { container } = render(<MoreCreators />);
    const creatorLabels = Array.from(
      container.querySelectorAll(".kl-more__label"),
    ).map((el) => (el.textContent ?? "").trim());
    expect(creatorLabels.slice(0, 4)).toEqual([
      "Star Wars Intro",
      "The Last of Us Intro",
      "House of the Dragon Intro",
      "Game of Thrones Intro",
    ]);
  });

  it("renders a looping preview video for each creator that has a video URL", () => {
    const creators: IntroCreatorLink[] = [
      { slug: "star-wars", label: "Star Wars Intro", href: "https://starwarsintrocreator.kassellabs.io", video: "https://cdn.example/sw.mp4" },
      { slug: "westworld", label: "Westworld Intro", href: "https://westworldintrocreator.kassellabs.io", video: "https://cdn.example/ww.mp4" },
      { slug: "breaking-bad", label: "Breaking Bad Intro", href: "https://breakingbadintrocreator.kassellabs.io" },
    ];
    const { container } = render(<MoreCreators creators={creators} />);
    // Exactly one <video> per creator that has a video URL (2 out of 3).
    expect(container.querySelectorAll("video").length).toBe(2);
    for (const creator of creators.filter((c) => c.video)) {
      const source = container.querySelector(
        `video source[src="${creator.video}"]`,
      );
      expect(source).not.toBeNull();
      const video = source!.closest("video") as HTMLVideoElement;
      // Decorative autoplay loop, muted. React sets `muted` as a property,
      // not a reflected attribute — assert the property.
      expect(video.loop).toBe(true);
      expect(video.muted).toBe(true);
      expect(video.autoplay).toBe(true);
      expect(source!.closest("a")).toHaveAttribute("href", creator.href);
    }
  });

  it("shows label tiles (no video) for creators with no video", () => {
    const creators: IntroCreatorLink[] = OTHER_INTRO_CREATORS.map((c) => ({
      ...c,
    }));
    const { container } = render(<MoreCreators creators={creators} />);
    expect(container.querySelectorAll("video").length).toBe(0);
  });

  it("links to the Kassel Labs hub", () => {
    render(<MoreCreators />);
    const links = screen.getAllByRole("link");
    expect(
      links.some((l) => l.getAttribute("href") === KASSEL_LABS_URL),
    ).toBe(true);
  });

  it("does not link back to the Among Us Ejector itself", () => {
    render(<MoreCreators />);
    const links = screen.getAllByRole("link");
    expect(
      links.every(
        (l) => !(l.getAttribute("href") ?? "").includes("ejector.kassellabs.io"),
      ),
    ).toBe(true);
  });
});
