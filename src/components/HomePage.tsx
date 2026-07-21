"use client";

import { useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { staticCharacterFrames } from "@/lib/characterImages";
import { DEFAULT_CHARACTER_URL } from "@/remotion/EjectorComposition";
import { trackEvent } from "@/lib/tracking";
import type { CharacterFrames, EjectorProps } from "@/types";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PlayerPreview } from "@/components/PlayerPreview";
import { EditorForm } from "@/components/EditorForm";
import { ErrorDialog } from "@/components/ErrorDialog";
import { useSoundOn } from "@/components/SoundToggle";

export function HomePage() {
  const t = useT();
  // The translated defaults are captured once, using the locale at mount, so
  // that later language switches don't clobber text the user may have edited.
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

  // Fire ejection_form_text_changed exactly once, on the first text edit.
  const textEditTracked = useRef(false);
  function trackFirstTextEdit() {
    if (textEditTracked.current) return;
    textEditTracked.current = true;
    trackEvent("ejection_form_text_changed");
  }

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
          <EditorForm
            ejectedText={ejectedText}
            impostorText={impostorText}
            characterFrames={characterFrames}
            onEjectedTextChange={(value) => {
              trackFirstTextEdit();
              setEjectedText(value);
            }}
            onImpostorTextChange={(value) => {
              trackFirstTextEdit();
              setImpostorText(value);
            }}
            onCharacterFramesChange={setCharacterFrames}
          />
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
