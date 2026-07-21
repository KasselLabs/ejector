"use client";

import { useState, type FormEvent } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { subscribeNewsletter } from "@/lib/newsletter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SubscribeForm() {
  const t = useT();
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await subscribeNewsletter(email, locale);
      setSubscribed(true);
    } catch {
      setError(t("Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-lg font-semibold text-white">
        {t("Available Soon!")}
      </h2>
      <p className="text-sm text-white/60">
        {t(
          "We plan to launch more features, like victory/defeat screen generators and much more!",
        )}
      </p>
      {subscribed ? (
        <p className="text-sm text-white/80">
          {t("Thanks! We'll notify you as soon as it is ready! 🚀")}
        </p>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
          <p className="text-sm text-white/60">
            {t(
              "Add your email below if you want to get notified as soon as we do it!",
            )}
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("Your email")}
              aria-label={t("Your email")}
            />
            <Button type="submit" disabled={submitting}>
              {t("Subscribe")}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}
    </div>
  );
}
