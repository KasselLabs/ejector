/**
 * Route remote http(s) image URLs through the same-origin proxy
 * (`/api/proxy-image`) so they can be fetched/decoded without cross-origin
 * taint. data:, blob: and relative URLs are returned unchanged.
 *
 * (Replaces the external cors.kassellabs.io proxy, which is broken at the
 * infra level — it collapses the target scheme's `//` and 404s.)
 */
export function getCorsUrl(url: string): string {
  return /^https?:\/\//.test(url)
    ? `/api/proxy-image?url=${encodeURIComponent(url)}`
    : url;
}
