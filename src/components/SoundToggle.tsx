"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";

const STORAGE_KEY = "ejector-sound-on";

// soundOn is app-global external state (localStorage), read through
// useSyncExternalStore so the server snapshot (true) matches the first client
// render and the persisted value is only applied after hydration — the same
// pattern used for the locale store, avoiding a hydration mismatch.
type Listener = () => void;
const listeners = new Set<Listener>();
let cachedValue: boolean | null = null;

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  if (cachedValue === null) {
    cachedValue = window.localStorage.getItem(STORAGE_KEY) !== "false";
  }
  return cachedValue;
}

function getServerSnapshot(): boolean {
  return true;
}

function commit(value: boolean) {
  cachedValue = value;
  window.localStorage.setItem(STORAGE_KEY, String(value));
  listeners.forEach((listener) => listener());
}

export function useSoundOn(): [boolean, (value: boolean) => void] {
  const soundOn = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const setSoundOn = useCallback((value: boolean) => commit(value), []);
  return [soundOn, setSoundOn];
}

export function SoundToggle({
  soundOn,
  onToggle,
}: {
  soundOn: boolean;
  onToggle: (value: boolean) => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      aria-pressed={soundOn}
      aria-label={t("Sound")}
      onClick={() => onToggle(!soundOn)}
      className="inline-flex items-center gap-1.5 uppercase tracking-wide text-white"
    >
      <span className="text-sm font-medium">{t("Sound")}</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- static white speaker svg, not optimizable */}
      <img
        src={soundOn ? "/audio-on.svg" : "/audio-off.svg"}
        alt=""
        width={24}
        height={24}
      />
    </button>
  );
}
