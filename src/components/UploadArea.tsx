"use client";

import { useState, type ChangeEvent } from "react";
import { useT } from "@/lib/i18n";
import { CropDialog } from "@/components/CropDialog";
import type { CharacterFrames } from "@/types";

export function UploadArea({
  previewUrl,
  onChange,
  onError,
}: {
  previewUrl: string;
  onChange: (frames: CharacterFrames) => void;
  onError?: (message: string) => void;
}) {
  const t = useT();
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so re-selecting the same file still fires a change event.
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPendingImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="min-h-full">
      <label className="relative flex min-h-full min-w-[132px] max-w-[132px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border-[3px] border-dotted border-white p-3 text-center">
        <span className="absolute -top-[15px] left-1/2 -translate-x-1/2 bg-black px-2 py-1 text-white">
          {t("OR")}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URL previews are not optimizable by next/image */}
        <img src={previewUrl} alt="" className="h-8 w-auto" />
        <span className="text-[0.85em] text-white">
          {t("Upload an Ejection Image Here")}
        </span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={t("Upload an Ejection Image Here")}
          onChange={handleFileChange}
        />
      </label>
      <CropDialog
        image={pendingImage}
        open={pendingImage !== null}
        onClose={() => setPendingImage(null)}
        onChange={(frames) => {
          onChange(frames);
          setPendingImage(null);
        }}
        onError={onError}
      />
    </div>
  );
}
