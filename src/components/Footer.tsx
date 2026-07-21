"use client";

import { useT } from "@/lib/i18n";
import { SupportEmailLink } from "@/components/SupportEmailLink";

const KASSEL_LABS_URL = "https://kassellabs.io";

export function Footer() {
  const t = useT();
  return (
    <footer className="mt-16 border-t border-white/10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-10 text-center text-sm text-white/60 sm:px-6">
        <p>
          {t("Made with love by")}{" "}
          <a
            href={KASSEL_LABS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            Kassel Labs
          </a>
        </p>
        <p>
          {t("Want to discover more web apps like this?")}{" "}
          <a
            href={KASSEL_LABS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#d1211d] underline-offset-4 hover:underline"
          >
            {t("Check our website")}
          </a>
        </p>
        <p className="text-white/50">
          {t("If you have any questions, please email us at")}{" "}
          <SupportEmailLink className="text-white/80 underline-offset-4 hover:text-white hover:underline" />
        </p>
      </div>
    </footer>
  );
}
