"use client";

import { useT } from "@/lib/i18n";
import { OutlinedField } from "@/components/OutlinedField";
import { CharacterGenerator } from "@/components/CharacterGenerator";
import { UploadArea } from "@/components/UploadArea";
import { ImageUrlField } from "@/components/ImageUrlField";
import { SoundToggle } from "@/components/SoundToggle";
import type { CharacterFrames } from "@/types";

export function EditorForm({
  ejectedText,
  impostorText,
  characterFrames,
  soundOn,
  onToggleSound,
  onEjectedTextChange,
  onImpostorTextChange,
  onCharacterFramesChange,
  onError,
}: {
  ejectedText: string;
  impostorText: string;
  characterFrames: CharacterFrames;
  soundOn: boolean;
  onToggleSound: (value: boolean) => void;
  onEjectedTextChange: (value: string) => void;
  onImpostorTextChange: (value: string) => void;
  onCharacterFramesChange: (frames: CharacterFrames) => void;
  onError?: (message: string) => void;
}) {
  const t = useT();
  const previewUrl = characterFrames.frames[0]?.imageUrl ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-white">{t("Ejector")}</h1>
        <SoundToggle soundOn={soundOn} onToggle={onToggleSound} />
      </div>

      <CharacterGenerator onChange={onCharacterFramesChange} />

      <div className="flex w-full items-stretch gap-2">
        <UploadArea
          previewUrl={previewUrl}
          onChange={onCharacterFramesChange}
          onError={onError}
        />
        <div className="flex flex-1 flex-col justify-center gap-6">
          <OutlinedField
            label={t("Ejection Text")}
            value={ejectedText}
            onChange={(event) => onEjectedTextChange(event.target.value)}
          />
          <OutlinedField
            label={t("Impostor Remain text")}
            value={impostorText}
            onChange={(event) => onImpostorTextChange(event.target.value)}
          />
        </div>
      </div>

      <ImageUrlField onChange={onCharacterFramesChange} onError={onError} />
    </div>
  );
}
