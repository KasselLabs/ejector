import type { MetadataRoute } from "next";

// Homepage only: /unsubscribe is noindex (it's a transactional utility page).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://ejector.kassellabs.io",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
