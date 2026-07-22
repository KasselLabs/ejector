"use client";

import { useEffect, useRef } from "react";
import type { IntroCreatorLink } from "@/lib/introCreators";

/** How far ahead of the viewport a card starts loading its preview clip. */
const ROOT_MARGIN = "200px";

function attach(video: HTMLVideoElement) {
  const src = video.dataset.src;
  if (!src || video.src) return;
  video.src = src;
  video.load();
  // The silent loop is decorative — a rejected/absent play() is fine.
  video.play()?.catch(() => {});
}

/**
 * The gallery grid. Client component purely so the preview clips can be lazy:
 * the `<video>` elements ship with `preload="none"` and no `src` at all, and a
 * single IntersectionObserver attaches the source (and starts the silent loop)
 * once a card comes near the viewport. The links and labels are still emitted
 * in the SSR HTML — client components are server-rendered too — so the gallery
 * stays crawlable.
 */
export function CreatorGrid({ creators }: { creators: IntroCreatorLink[] }) {
  const gridRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    const videos = Array.from(
      root.querySelectorAll<HTMLVideoElement>("video[data-src]"),
    );
    if (videos.length === 0) return;

    // No observer support (old browsers, jsdom): just load them.
    if (typeof IntersectionObserver === "undefined") {
      videos.forEach(attach);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          attach(entry.target as HTMLVideoElement);
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    videos.forEach((video) => observer.observe(video));

    return () => observer.disconnect();
  }, [creators]);

  return (
    <nav ref={gridRef} className="kl-more__grid" aria-label="Other intro creators">
      {creators.map((creator) => {
        const video = creator.video;
        return (
          <a
            key={creator.href}
            href={creator.href}
            target="_blank"
            rel="noopener noreferrer"
            className="kl-more__card"
          >
            <span className="kl-more__media">
              {video ? (
                <video
                  className="kl-more__video"
                  muted
                  autoPlay
                  loop
                  playsInline
                  preload="none"
                  data-src={video}
                  aria-hidden
                />
              ) : (
                <span className="kl-more__media-fallback" aria-hidden>
                  {creator.label.replace(/\s*Intro$/, "")}
                </span>
              )}
            </span>
            <span className="kl-more__label">{creator.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
