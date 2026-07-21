"use client";

import { useT } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CharacterGenerator } from "@/components/CharacterGenerator";
import { UploadArea } from "@/components/UploadArea";
import { ImageUrlField } from "@/components/ImageUrlField";
import type { CharacterFrames } from "@/types";

export function EditorForm({
  ejectedText,
  impostorText,
  characterFrames,
  onEjectedTextChange,
  onImpostorTextChange,
  onCharacterFramesChange,
  onError,
}: {
  ejectedText: string;
  impostorText: string;
  characterFrames: CharacterFrames;
  onEjectedTextChange: (value: string) => void;
  onImpostorTextChange: (value: string) => void;
  onCharacterFramesChange: (frames: CharacterFrames) => void;
  onError?: (message: string) => void;
}) {
  const t = useT();
  const previewUrl = characterFrames.frames[0]?.imageUrl ?? "";

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="ejected-text" className="text-white/80">
          {t("Ejection Text")}
        </Label>
        <Input
          id="ejected-text"
          value={ejectedText}
          onChange={(event) => onEjectedTextChange(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="impostor-text" className="text-white/80">
          {t("Impostor Remain text")}
        </Label>
        <Input
          id="impostor-text"
          value={impostorText}
          onChange={(event) => onImpostorTextChange(event.target.value)}
        />
      </div>

      <CharacterGenerator onChange={onCharacterFramesChange} />

      <div className="flex items-stretch gap-3">
        <UploadArea
          previewUrl={previewUrl}
          onChange={onCharacterFramesChange}
          onError={onError}
        />
        <div className="flex flex-1 flex-col justify-center gap-2">
          <span className="text-center text-xs font-medium text-white/40">
            {t("OR")}
          </span>
          <ImageUrlField onChange={onCharacterFramesChange} onError={onError} />
        </div>
      </div>
    </div>
  );
}
