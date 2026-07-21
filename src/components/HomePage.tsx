"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";
import { trackEvent } from "@/lib/tracking";
import type { CharacterFrames, EjectorProps } from "@/types";
import { Navbar } from "@/components/Navbar";
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
      showWatermark: false,
    }),
    [ejectedText, impostorText, characterFrames],
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar soundOn={soundOn} onToggleSound={setSoundOn} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-4">
            <PlayerPreview props={props} soundOn={soundOn} />
          </div>
          <div className="flex flex-col gap-4">
            <EditorForm
              ejectedText={ejectedText}
              impostorText={impostorText}
              characterFrames={characterFrames}
              onEjectedTextChange={(value) => {
                markEdited("ejected");
                setEjectedText(value);
              }}
              onImpostorTextChange={(value) => {
                markEdited("impostor");
                setImpostorText(value);
              }}
              onCharacterFramesChange={setCharacterFrames}
            />
            <DownloadSection props={props} />
          </div>
        </div>
        <div className="mt-6">
          <SubscribeForm />
        </div>
      </main>
      <Footer />
      <ErrorDialog
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
      />
    </div>
  );
}
