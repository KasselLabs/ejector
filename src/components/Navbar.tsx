"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { SoundToggle } from "@/components/SoundToggle";
import { LanguageToggle } from "@/components/LanguageToggle";

export function Navbar({
  soundOn,
  onToggleSound,
}: {
  soundOn: boolean;
  onToggleSound: (value: boolean) => void;
}) {
  const t = useT();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0e1a]/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Ejector">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-lg bg-[#d1211d] shadow-md shadow-[#d1211d]/30"
          >
            <span className="block h-3 w-1.5 rounded-full bg-white/90" />
          </span>
          <span className="text-base font-semibold tracking-tight text-white">
            {t("Ejector")}
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <SoundToggle soundOn={soundOn} onToggle={onToggleSound} />
          <LanguageToggle />
        </div>
      </nav>
    </header>
  );
}
