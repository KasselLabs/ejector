/**
 * Route remote http(s) image URLs through the shared Kassel Labs CORS proxy
 * so they can be fetched/decoded without cross-origin taint. data:, blob: and
 * relative URLs are returned unchanged.
 */
export function getCorsUrl(url: string): string {
  return /^https?:\/\//.test(url)
    ? `https://cors.kassellabs.io/${url}`
    : url;
}
