"use client";

import { useLocale, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "pt-BR", label: "PT-BR" },
];

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-full border border-white/10 p-0.5 text-xs font-medium"
    >
      {OPTIONS.map((option) => {
        const active = option.value === locale;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(option.value)}
            className={cn(
              "rounded-full px-2.5 py-1 transition-colors",
              active
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
