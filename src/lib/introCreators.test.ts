import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { adminGraphqlUrl } from "./config";
import { fetchIntroCreators, OTHER_INTRO_CREATORS } from "./introCreators";

describe("fetchIntroCreators", () => {
  it("omits this app (among-us-ejector) but keeps the other creators", async () => {
    server.use(
      http.post(adminGraphqlUrl, () =>
        HttpResponse.json({
          data: {
            introTypes: {
              data: [
                { slug: "among-us-ejector", name: "Among Us Ejector", type: "intro_creator", preview_video: { url: "https://cdn.example/ej.mp4" } },
                { slug: "star-wars", name: "Star Wars Intro Creator", type: "intro_creator", preview_video: { url: "https://cdn.example/sw.mp4" } },
                { slug: "westworld", name: "Westworld Intro Creator", type: "intro_creator", preview_video: { url: "https://cdn.example/ww.mp4" } },
              ],
            },
          },
        }),
      ),
    );
    const creators = await fetchIntroCreators();
    expect(creators.every((c) => c.slug !== "among-us-ejector")).toBe(true);
    expect(creators.find((c) => c.slug === "star-wars")).toBeDefined();
    expect(creators.find((c) => c.slug === "westworld")).toBeDefined();
  });

  it("includes only intro_creator types, excluding manual_intro entries", async () => {
    server.use(
      http.post(adminGraphqlUrl, () =>
        HttpResponse.json({
          data: {
            introTypes: {
              data: [
                { slug: "westworld", name: "Westworld Intro Creator", type: "intro_creator", preview_video: null },
                { slug: "star-wars", name: "Star Wars Intro Creator", type: "intro_creator", preview_video: null },
                { slug: "disney", name: "Disney", type: "manual_intro", preview_video: null },
                { slug: "netflix", name: "Netflix", type: "manual_intro", preview_video: null },
              ],
            },
          },
        }),
      ),
    );
    const creators = await fetchIntroCreators();
    expect(creators.map((c) => c.slug)).toEqual(["westworld", "star-wars"]);
    expect(creators.every((c) => c.slug !== "disney")).toBe(true);
  });

  it("strips trailing ' Creator' from name to produce label", async () => {
    server.use(
      http.post(adminGraphqlUrl, () =>
        HttpResponse.json({
          data: {
            introTypes: {
              data: [
                { slug: "westworld", name: "Westworld Intro Creator", type: "intro_creator", preview_video: null },
                { slug: "game-of-thrones", name: "Game of Thrones Intro creator", type: "intro_creator", preview_video: null },
                { slug: "breaking-bad", name: "Breaking Bad Intro", type: "intro_creator", preview_video: null },
              ],
            },
          },
        }),
      ),
    );
    const creators = await fetchIntroCreators();
    expect(creators.find((c) => c.slug === "westworld")!.label).toBe("Westworld Intro");
    expect(creators.find((c) => c.slug === "game-of-thrones")!.label).toBe("Game of Thrones Intro");
    // No trailing 'Creator' — label should remain unchanged.
    expect(creators.find((c) => c.slug === "breaking-bad")!.label).toBe("Breaking Bad Intro");
  });

  it("derives href from slug by removing hyphens", async () => {
    server.use(
      http.post(adminGraphqlUrl, () =>
        HttpResponse.json({
          data: {
            introTypes: {
              data: [
                { slug: "house-of-the-dragon", name: "House of the Dragon Intro Creator", type: "intro_creator", preview_video: null },
                { slug: "the-last-of-us", name: "The Last of Us Intro Creator", type: "intro_creator", preview_video: null },
              ],
            },
          },
        }),
      ),
    );
    const creators = await fetchIntroCreators();
    expect(creators.find((c) => c.slug === "house-of-the-dragon")!.href).toBe(
      "https://houseofthedragonintrocreator.kassellabs.io",
    );
    expect(creators.find((c) => c.slug === "the-last-of-us")!.href).toBe(
      "https://thelastofusintrocreator.kassellabs.io",
    );
  });

  it("includes the resolved preview video URL on each creator", async () => {
    server.use(
      http.post(adminGraphqlUrl, () =>
        HttpResponse.json({
          data: {
            introTypes: {
              data: [
                { slug: "westworld", name: "Westworld Intro Creator", type: "intro_creator", preview_video: { url: "https://cdn.example/ww.mp4" } },
                { slug: "breaking-bad", name: "Breaking Bad Intro Creator", type: "intro_creator", preview_video: null },
              ],
            },
          },
        }),
      ),
    );
    const creators = await fetchIntroCreators();
    expect(creators.find((c) => c.slug === "westworld")!.video).toBe("https://cdn.example/ww.mp4");
    expect(creators.find((c) => c.slug === "breaking-bad")!.video).toBeUndefined();
  });

  it("resolves relative media URLs against the admin origin", async () => {
    server.use(
      http.post(adminGraphqlUrl, () =>
        HttpResponse.json({
          data: {
            introTypes: {
              data: [{ slug: "westworld", name: "Westworld Intro Creator", type: "intro_creator", preview_video: { url: "/uploads/ww.mp4" } }],
            },
          },
        }),
      ),
    );
    const creators = await fetchIntroCreators();
    // .env.test: NEXT_PUBLIC_ADMIN_GRAPHQL_URL=https://admin.test/graphql
    expect(creators.find((c) => c.slug === "westworld")!.video).toBe(
      "https://admin.test/uploads/ww.mp4",
    );
  });

  it("returns the hardcoded fallback list when the request fails (graceful degradation)", async () => {
    server.use(
      http.post(adminGraphqlUrl, () => new HttpResponse(null, { status: 500 })),
    );
    expect(await fetchIntroCreators()).toEqual(OTHER_INTRO_CREATORS);
  });

  it("returns the hardcoded fallback list when the admin returns an empty roster", async () => {
    server.use(
      http.post(adminGraphqlUrl, () =>
        HttpResponse.json({ data: { introTypes: { data: [] } } }),
      ),
    );
    expect(await fetchIntroCreators()).toEqual(OTHER_INTRO_CREATORS);
  });
});
