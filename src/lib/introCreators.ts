import { adminGraphqlUrl } from "./config";

/**
 * Other Kassel Labs intro creators, linked from the navbar "MORE APPS"
 * dropdown and the home-page "More intro creators" gallery.
 *
 * `slug` matches the admin (admin.kassellabs.io) `intro-type` slug. This app
 * (Among Us Ejector) is omitted from the list — we're already on it.
 *
 * This array is the OFFLINE FALLBACK used by `fetchIntroCreators` when the
 * admin GraphQL is unreachable. It is kept in sync manually.
 */
export interface IntroCreatorLink {
  label: string;
  href: string;
  /** admin intro-type slug. */
  slug: string;
  /** Looping preview clip URL (from admin), if available. */
  video?: string;
}

export const OTHER_INTRO_CREATORS: IntroCreatorLink[] = [
  { label: "Star Wars Intro", href: "https://starwarsintrocreator.kassellabs.io", slug: "star-wars" },
  { label: "The Last of Us Intro", href: "https://thelastofusintrocreator.kassellabs.io", slug: "the-last-of-us" },
  { label: "House of the Dragon Intro", href: "https://houseofthedragonintrocreator.kassellabs.io", slug: "house-of-the-dragon" },
  { label: "Game of Thrones Intro", href: "https://gameofthronesintrocreator.kassellabs.io", slug: "game-of-thrones" },
  { label: "Stranger Things Intro", href: "https://strangerthingsintrocreator.kassellabs.io", slug: "stranger-things" },
  { label: "Westworld Intro", href: "https://westworldintrocreator.kassellabs.io", slug: "westworld" },
  { label: "Breaking Bad Intro", href: "https://breakingbadintrocreator.kassellabs.io", slug: "breaking-bad" },
];

/** The Kassel Labs hub linking every product. */
export const KASSEL_LABS_URL = "https://kassellabs.io";

/** This app's own slug — excluded from the "other creators" list. */
const OWN_SLUG = "among-us-ejector";

/** The admin `intro-type` `type` value for the interactive intro creators. */
const INTRO_CREATOR_TYPE = "intro_creator";

const INTRO_TYPES_QUERY = `
  query GetIntroCreators {
    introTypes {
      data {
        slug
        name
        type
        preview_video { url }
      }
    }
  }
`;

interface IntroTypeNode {
  slug?: string | null;
  name?: string | null;
  type?: string | null;
  preview_video?: { url?: string | null } | null;
}

/** Strapi media URLs are usually absolute (S3); prepend the admin origin if relative. */
function resolveMediaUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const adminUrl = adminGraphqlUrl || "https://admin.kassellabs.io/graphql";
  const base = adminUrl.replace(/\/graphql\/?$/, "");
  return `${base}${url}`;
}

/**
 * Derive the public hostname for a creator from its slug.
 * e.g. "house-of-the-dragon" → "https://houseofthedragonintrocreator.kassellabs.io"
 */
function slugToHref(slug: string): string {
  return `https://${slug.replace(/-/g, "")}introcreator.kassellabs.io`;
}

/**
 * Fetch the full roster of other intro creators from the admin GraphQL.
 * Server-side; cached for an hour. On ANY failure (network / non-200 /
 * parse error) OR an empty result, returns the hardcoded `OTHER_INTRO_CREATORS`
 * fallback (without `video` fields — degrades to label-only tiles).
 */
export async function fetchIntroCreators(): Promise<IntroCreatorLink[]> {
  const adminUrl = adminGraphqlUrl || "https://admin.kassellabs.io/graphql";
  try {
    const response = await fetch(adminUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: INTRO_TYPES_QUERY }),
      next: { revalidate: 3600 },
    });
    if (!response.ok) return OTHER_INTRO_CREATORS;
    const json = (await response.json()) as {
      data?: { introTypes?: { data?: IntroTypeNode[] } };
    };
    const nodes = json.data?.introTypes?.data ?? [];
    const creators: IntroCreatorLink[] = nodes
      .filter(
        (node) =>
          node.slug &&
          node.slug !== OWN_SLUG &&
          node.type === INTRO_CREATOR_TYPE,
      )
      .map((node) => {
        const slug = node.slug!;
        const rawName = node.name ?? slug;
        const label = rawName.replace(/\s*Creator\s*$/i, "") || rawName;
        const rawUrl = node.preview_video?.url;
        const video = rawUrl ? resolveMediaUrl(rawUrl) : undefined;
        return { slug, label, href: slugToHref(slug), video };
      });
    if (creators.length === 0) return OTHER_INTRO_CREATORS;
    return creators;
  } catch {
    return OTHER_INTRO_CREATORS;
  }
}
