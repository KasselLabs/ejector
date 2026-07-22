"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";
import { trackEvent } from "@/lib/tracking";
import type { CharacterFrames, EjectorProps } from "@/types";
import { AboutSection } from "@/components/AboutSection";
import { Footer } from "@/components/Footer";
import { PlayerPreview } from "@/components/PlayerPreview";
import { EditorForm } from "@/components/EditorForm";
import { DownloadSection } from "@/components/DownloadSection";
import { SubscribeForm } from "@/components/SubscribeForm";
import { ErrorDialog } from "@/components/ErrorDialog";
import { useSoundOn } from "@/components/SoundToggle";

export function HomePage() {
  const t = useT();
  const { locale } = useLocale();
  // The translated defaults are captured once with the SSR-safe locale ("en"),
  // then re-seeded by the effect below once locale detection resolves — but
  // only while the user hasn't edited yet, so their input is never clobbered.
  const [ejectedText, setEjectedText] = useState(() =>
    t("Red was not The Impostor"),
  );
  const [impostorText, setImpostorText] = useState(() =>
    t("1 Impostor remains"),
  );
  const [characterFrames, setCharacterFrames] = useState<CharacterFrames>(() =>
    staticCharacterFrames(DEFAULT_CHARACTER_URL),
  );
  const [soundOn, setSoundOn] = useSoundOn();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Per-field edit tracking: each field freezes its own locale re-seed once the
  // user touches it, so editing one field never freezes the other. The
  // ejection_form_text_changed event still fires exactly once, on the first
  // edit of either field.
  const editedFieldsRef = useRef({ ejected: false, impostor: false });
  const textChangeTrackedRef = useRef(false);
  function markEdited(field: "ejected" | "impostor") {
    editedFieldsRef.current[field] = true;
    if (textChangeTrackedRef.current) return;
    textChangeTrackedRef.current = true;
    trackEvent("ejection_form_text_changed");
  }

  // Re-seed the translated defaults once locale detection resolves (SSR-safe
  // first render is always "en"), re-seeding each field independently while it
  // remains untouched so a user's edits are never clobbered.
  useEffect(() => {
    if (!editedFieldsRef.current.ejected) {
      setEjectedText(t("Red was not The Impostor"));
    }
    if (!editedFieldsRef.current.impostor) {
      setImpostorText(t("1 Impostor remains"));
    }
  }, [locale, t]);

  const props: EjectorProps = useMemo(
    () => ({
      ejectedText,
      impostorText,
      characterFrames,
      // Legacy parity: the live preview always carries the watermark; only
      // the paid full-hd export renders clean.
      showWatermark: true,
    }),
    [ejectedText, impostorText, characterFrames],
  );

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center px-4 py-4 max-lg:justify-start">
      <SubscribeForm />
      <div className="w-full max-w-[680px] max-lg:max-w-[calc(100vw-32px)]">
        <div className="mb-4 flex flex-col gap-4 rounded-[10px] border-[3px] border-solid border-white p-4">
          <EditorForm
            ejectedText={ejectedText}
            impostorText={impostorText}
            characterFrames={characterFrames}
            soundOn={soundOn}
            onToggleSound={setSoundOn}
            onEjectedTextChange={(value) => {
              markEdited("ejected");
              setEjectedText(value);
            }}
            onImpostorTextChange={(value) => {
              markEdited("impostor");
              setImpostorText(value);
            }}
            onCharacterFramesChange={setCharacterFrames}
            onError={setErrorMessage}
          />
          <DownloadSection props={props} />
        </div>
        <PlayerPreview props={props} soundOn={soundOn} />
        <AboutSection />
        <Footer />
      </div>
      <ErrorDialog
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
      />
    </div>
  );
}
