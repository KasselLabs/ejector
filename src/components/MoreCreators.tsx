import {
  OTHER_INTRO_CREATORS,
  KASSEL_LABS_URL,
  type IntroCreatorLink,
} from "@/lib/introCreators";
import { CreatorGrid } from "@/components/CreatorGrid";

interface MoreCreatorsProps {
  /**
   * The list of other intro creators to display, with optional preview videos
   * already resolved. Defaults to the hardcoded fallback list when omitted.
   * Produced by `fetchIntroCreators()` in the parent Server Component.
   */
  creators?: IntroCreatorLink[];
}

/**
 * "More intro creators" gallery — a grid of the other Kassel Labs intro
 * creators, each with its looping preview clip from the admin GraphQL. Server
 * component so the links are crawlable and the data fetching stays on the
 * server; only the grid itself is a client component, so the clips can be
 * lazily attached as the gallery scrolls into view (see CreatorGrid).
 * Styled in Roboto/white to blend with the Ejector theme (no StarWars font).
 * Data lives in src/lib/introCreators.ts.
 */
export function MoreCreators({ creators = OTHER_INTRO_CREATORS }: MoreCreatorsProps) {
  return (
    <section className="kl-more" aria-label="More from Kassel Labs">
      <style>{MORE_CSS}</style>
      <h2 className="kl-more__title">More intro creators</h2>
      <CreatorGrid creators={creators} />
      <a
        href={KASSEL_LABS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="kl-more__hub"
      >
        See all Kassel Labs creators →
      </a>
    </section>
  );
}

const MORE_CSS = `
.kl-more {
  max-width: 920px;
  margin: 0 auto;
  padding: 48px 24px 64px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  font-family: var(--font-roboto), Roboto, Helvetica, Arial, sans-serif;
}
.kl-more__title {
  font-family: var(--font-roboto), Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: 0.06em;
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 24px;
}
.kl-more__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}
.kl-more__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.kl-more__card:hover {
  border-color: #ffffff;
  transform: translateY(-2px);
}
.kl-more__media {
  display: block;
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}
.kl-more__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.kl-more__media-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  text-align: center;
  letter-spacing: 0.04em;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
}
.kl-more__label {
  font-size: 13px;
  letter-spacing: 0.04em;
  color: #ffffff;
}
.kl-more__hub {
  display: inline-block;
  font-size: 13px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
}
.kl-more__hub:hover {
  color: #ffffff;
}
`;
