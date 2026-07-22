"use client";

import { useT } from "@/lib/i18n";

/**
 * Supporting on-page content: the editor above stays the primary element, so
 * this stays visually calm -- plain black, white text, generous spacing.
 */
export function AboutSection() {
  const t = useT();

  const faq = [
    {
      question: t("Can I use any crewmate color?"),
      answer: t(
        "Yes — every standard Among Us color is here, plus custom image uploads.",
      ),
    },
    {
      question: t("Does this render on your servers?"),
      answer: t(
        "No — Ejector renders everything in your browser, so nothing you type or upload is ever stored by us.",
      ),
    },
    {
      question: t("Can I use this for streams or YouTube?"),
      answer: t("That's exactly what the paid video tiers are for."),
    },
  ];

  return (
    // Sits at the very bottom of the page, below the creators gallery, and
    // shares its container (920px, centred, divider on top) so the two
    // supporting sections read as one rhythm rather than stray prose.
    <section className="mx-auto flex max-w-[920px] flex-col gap-6 border-t border-white/15 px-6 pt-12 pb-16 text-white">
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">
          {t("Make Your Own Ejection GIF or Video")}
        </h2>
        <p className="text-sm leading-relaxed text-white/80">
          {t(
            "Type a name, pick or upload a crewmate, and watch them get voted off in the classic Among Us ejection animation — cape, spin, and all. The ejection text can say anything you want. Swap the stock crewmate color for your own image or GIF if you'd rather eject a face, a logo, or a friend.",
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">{t("How It Works")}</h3>
        <p className="text-sm leading-relaxed text-white/80">
          {t(
            "Pick a crewmate color or upload your own image. Edit the ejection text and the impostor-remain line. Preview the animation, then download.",
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">{t("Free GIF vs. Paid Video")}</h3>
        <p className="text-sm leading-relaxed text-white/80">
          {t(
            "The GIF download is free forever, with a small watermark. Want it clean for a stream, a Discord clip, or a short? A 720p MP4 with watermark is $3, and a watermark-free 1080p MP4 is $5. No account needed — pay once, download for 24 hours.",
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">{t("FAQ")}</h3>
        {faq.map(({ question, answer }) => (
          <p key={question} className="text-sm leading-relaxed text-white/80">
            <strong className="font-medium text-white">{question}</strong>{" "}
            {answer}
          </p>
        ))}
      </div>
    </section>
  );
}
