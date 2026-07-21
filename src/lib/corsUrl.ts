export function getCorsUrl(url: string): string {
  return /^https?:\/\//.test(url)
    ? `https://cors.kassellabs.io/${url}`
    : url;
}
