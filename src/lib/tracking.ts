declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(...args: unknown[]): void {
  if (typeof window === "undefined" || !window.gtag) {
    console.log(...args);
    return;
  }
  window.gtag(...args);
}

export function trackEvent(
  name: string,
  params: Record<string, unknown> = {},
): void {
  track("event", name, params);
}
