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
      className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/50"
    >
      {OPTIONS.map((option, index) => {
        const active = option.value === locale;
        return (
          <span key={option.value} className="inline-flex items-center gap-1">
            {index > 0 && <span aria-hidden>·</span>}
            <button
              type="button"
              aria-pressed={active}
              onClick={() => setLocale(option.value)}
              className={cn(
                "transition-colors hover:text-white",
                active ? "text-white underline" : "text-white/50",
              )}
            >
              {option.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}
