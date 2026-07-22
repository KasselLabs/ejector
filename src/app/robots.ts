import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      {
        // AI crawlers and assistant fetchers are explicitly welcomed so the
        // app stays citable in generative search results.
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "Claude-User",
          "anthropic-ai",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
          "CCBot",
          "Applebot-Extended",
          "DuckAssistBot",
          "Meta-ExternalAgent",
          "FacebookBot",
        ],
        allow: "/",
      },
    ],
    sitemap: "https://ejector.kassellabs.io/sitemap.xml",
    host: "https://ejector.kassellabs.io",
  };
}
