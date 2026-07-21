"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import ptBR from "@/locales/pt-BR.json";

export type Locale = "en" | "pt-BR";

const dictionaries: Record<Locale, Record<string, string>> = {
  en: {},
  "pt-BR": ptBR as Record<string, string>,
};

const STORAGE_KEY = "ejector-locale";

function detectLocale(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "pt-BR") return stored;
  return window.navigator.language?.toLowerCase().startsWith("pt")
    ? "pt-BR"
    : "en";
}

// Locale is app-global external state (localStorage), so it is read via
// useSyncExternalStore rather than derived in an effect: the server
// snapshot ("en") matches the initial client render, and the real
// (possibly different) locale is only applied once React has committed
// the client snapshot, avoiding a hydration mismatch.
type Listener = () => void;
const listeners = new Set<Listener>();
let cachedLocale: Locale | null = null;

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Locale {
  if (cachedLocale === null) {
    cachedLocale = detectLocale();
  }
  return cachedLocale;
}

function getServerSnapshot(): Locale {
  return "en";
}

function commitLocale(l: Locale) {
  cachedLocale = l;
  window.localStorage.setItem(STORAGE_KEY, l);
  listeners.forEach((listener) => listener());
}

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
}>({ locale: "en", setLocale: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setLocale = useCallback((l: Locale) => {
    commitLocale(l);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale() {
  return useContext(I18nContext);
}

export function useT(): (key: string) => string {
  const { locale } = useContext(I18nContext);
  return useCallback(
    (key: string) => dictionaries[locale][key] ?? key,
    [locale],
  );
}
