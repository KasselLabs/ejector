"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import { unsubscribeNewsletter } from "@/lib/newsletter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function UnsubscribePage() {
  const t = useT();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await unsubscribeNewsletter(email);
      setUnsubscribed(true);
    } catch {
      setError(t("Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-3 px-4 py-8">
      <h1 className="text-lg font-semibold text-white">
        {t("Ejector - Unsubscribe")}
      </h1>
      {unsubscribed ? (
        <p className="text-sm text-white/80">
          {t("You have been unsubscribed")}
        </p>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
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
              {t("Unsubscribe")}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}
    </div>
  );
}
