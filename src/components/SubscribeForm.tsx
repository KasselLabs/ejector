"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useT, useLocale } from "@/lib/i18n";
import { subscribeNewsletter } from "@/lib/newsletter";
import { trackEvent } from "@/lib/tracking";
import { OutlinedField } from "@/components/OutlinedField";
import { Button } from "@/components/ui/button";

function MapImage({
  src,
  href,
  available,
}: {
  src: string;
  href?: string;
  available?: boolean;
}) {
  const t = useT();
  const content = (
    <span className="relative m-2 flex min-w-[175px] justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static map thumbnail */}
      <img
        src={src}
        alt=""
        height={38}
        className={available ? "" : "opacity-30"}
      />
      {!available && (
        <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-base text-white">
          {t("Available Soon!")}
        </span>
      )}
    </span>
  );

  if (!available || !href) {
    return <span className="flex justify-center">{content}</span>;
  }

  return (
    <Link href={href} className="flex cursor-pointer justify-center">
      {content}
    </Link>
  );
}

export function SubscribeForm() {
  const t = useT();
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await subscribeNewsletter(email, locale);
      setEmail("");
      setShowToast(true);
      trackEvent("subscribe_submit", { event_category: "email" });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setShowToast(false), 3000);
    } catch {
      setError(t("Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="z-30 max-w-[280px] rounded-[10px] border-[3px] border-solid border-white lg:fixed lg:left-4 lg:top-[66px] max-lg:mb-2 max-lg:w-full max-lg:max-w-none"
      >
        <div className="relative p-4">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black px-2 text-[1.1em] font-bold text-white">
            {t("Choose your map")}
          </div>
          <div className="pb-2 max-lg:flex max-lg:flex-row max-lg:flex-wrap max-lg:justify-evenly">
            <MapImage src="/images/skeld.png" href="/" available />
            <MapImage src="/images/mirahq.png" />
            <MapImage src="/images/polus.png" />
          </div>
          <p className="pb-1 text-center text-white">
            {t(
              "We plan to launch more features, like victory/defeat screen generators and much more!",
            )}
          </p>
          <p className="pb-4 text-center text-white">
            {t(
              "Add your email below if you want to get notified as soon as we do it!",
            )}
          </p>
          <div className="flex flex-col items-center">
            <div className="w-full max-lg:w-[320px] max-[380px]:w-full">
              <OutlinedField
                label={t("Your Email")}
                type="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  trackEvent("subscribe_fill_text", { event_category: "email" });
                }}
              />
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full uppercase tracking-wide"
                  disabled={submitting}
                >
                  {submitting ? t("Loading") : t("Notify Me")}
                </Button>
              </div>
              {error && (
                <p className="pt-2 text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
        </div>
      </form>
      {showToast && (
        <div
          role="status"
          className="fixed right-4 top-4 z-50 max-w-[320px] rounded-lg bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          {t("Thanks! We'll notify you as soon as it is ready! 🚀")}
        </div>
      )}
    </>
  );
}
