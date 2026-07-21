"use client";

import { useSyncExternalStore } from "react";

// The address is assembled from parts at runtime and only rendered on the
// client so it never appears in the server-rendered HTML that scrapers read.
const USER = "contact";
const DOMAIN = "kassellabs.io";

const noopSubscribe = () => () => {};

export function SupportEmailLink({ className }: { className?: string }) {
  // Client-only guard without a state-in-effect: the server snapshot is false
  // and the client snapshot is true, so the link renders after hydration.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  if (!mounted) return null;

  const address = `${USER}@${DOMAIN}`;
  return (
    <a href={`mailto:${address}`} className={className}>
      {address}
    </a>
  );
}
