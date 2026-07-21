"use client";

import { useT } from "@/lib/i18n";
import { SupportEmailLink } from "@/components/SupportEmailLink";
import { LanguageToggle } from "@/components/LanguageToggle";

const KASSEL_LABS_URL = "https://kassellabs.io";

export function Footer() {
  const t = useT();
  return (
    <footer className="mt-2 flex flex-col items-center gap-1 py-2 text-center text-white">
      <p className="flex flex-wrap items-center justify-center">
        {t("Made with love by")}
        &nbsp;
        <a
          href={KASSEL_LABS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand svg */}
          {/* h-6 w-auto max-w-none: Tailwind preflight's `max-width:100%`
              collapses an intrinsically-sized svg inside this flex anchor */}
          <img
            src="/kassel-labs-logo.svg"
            alt="Kassel Labs"
            className="h-6 w-auto max-w-none"
          />
        </a>
      </p>
      <p className="flex flex-wrap items-center justify-center">
        {t("Want to discover more web apps like this?")}
        &nbsp;
        <a
          href={KASSEL_LABS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white underline"
        >
          {t("Check our website")}
        </a>
      </p>
      <p className="flex flex-wrap items-center justify-center">
        {t("Need help Contact us via email")}
        &nbsp;
        <SupportEmailLink className="text-white underline" />
      </p>
      <LanguageToggle />
    </footer>
  );
}
