import { describe, it, expect, vi } from "vitest";
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

  it("renders a lazy looping preview video for each creator that has a video URL", () => {
    const creators: IntroCreatorLink[] = [
      { slug: "star-wars", label: "Star Wars Intro", href: "https://starwarsintrocreator.kassellabs.io", video: "https://cdn.example/sw.mp4" },
      { slug: "westworld", label: "Westworld Intro", href: "https://westworldintrocreator.kassellabs.io", video: "https://cdn.example/ww.mp4" },
      { slug: "breaking-bad", label: "Breaking Bad Intro", href: "https://breakingbadintrocreator.kassellabs.io" },
    ];
    const { container } = render(<MoreCreators creators={creators} />);
    // Exactly one <video> per creator that has a video URL (2 out of 3).
    expect(container.querySelectorAll("video").length).toBe(2);
    for (const creator of creators.filter((c) => c.video)) {
      const video = container.querySelector<HTMLVideoElement>(
        `video[data-src="${creator.video}"]`,
      );
      expect(video).not.toBeNull();
      // Decorative autoplay loop, muted. React sets `muted` as a property,
      // not a reflected attribute — assert the property.
      expect(video!.loop).toBe(true);
      expect(video!.muted).toBe(true);
      expect(video!.autoplay).toBe(true);
      // Lazy: nothing is fetched until the card nears the viewport.
      expect(video!.getAttribute("preload")).toBe("none");
      expect(video!.querySelector("source")).toBeNull();
      expect(video!.closest("a")).toHaveAttribute("href", creator.href);
    }
  });

  it("server-renders the links but no video source", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const creators: IntroCreatorLink[] = [
      {
        slug: "star-wars",
        label: "Star Wars Intro",
        href: "https://starwarsintrocreator.kassellabs.io",
        video: "https://cdn.example/sw.mp4",
      },
    ];
    const html = renderToStaticMarkup(<MoreCreators creators={creators} />);
    expect(html).toContain('href="https://starwarsintrocreator.kassellabs.io"');
    expect(html).toContain("Star Wars Intro");
    expect(html).toContain('preload="none"');
    // The clip URL is only a data attribute — no plain src=, so nothing is
    // fetched from the server-rendered HTML.
    expect(html).toContain('data-src="https://cdn.example/sw.mp4"');
    expect(html).not.toMatch(/[^-]src="https:\/\/cdn\.example\/sw\.mp4"/);
  });

  it("attaches the preview source only once a card intersects the viewport", () => {
    const observed: Element[] = [];
    let trigger: ((entries: IntersectionObserverEntry[]) => void) | undefined;
    let options: IntersectionObserverInit | undefined;
    let instances = 0;
    class FakeObserver {
      constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
        instances += 1;
        options = opts;
        trigger = (entries) =>
          cb(entries, this as unknown as IntersectionObserver);
      }
      observe(el: Element) {
        observed.push(el);
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    const creators: IntroCreatorLink[] = [
      {
        slug: "star-wars",
        label: "Star Wars Intro",
        href: "https://starwarsintrocreator.kassellabs.io",
        video: "https://cdn.example/sw.mp4",
      },
    ];
    const { container } = render(<MoreCreators creators={creators} />);
    const video = container.querySelector("video") as HTMLVideoElement;

    // A single observer for the whole grid, pre-loading slightly off-screen.
    expect(instances).toBe(1);
    expect(options?.rootMargin).toBe("200px");
    expect(observed).toEqual([video]);
    expect(video.getAttribute("src")).toBeNull();

    trigger!([
      { isIntersecting: true, target: video } as unknown as IntersectionObserverEntry,
    ]);
    expect(video.getAttribute("src")).toBe("https://cdn.example/sw.mp4");

    vi.unstubAllGlobals();
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
