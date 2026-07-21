"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { staticCharacterFrames } from "@/lib/characterImages";
import {
  CHARACTER_COLORS,
  CHARACTER_SPRITE_URL,
  generateColoredCharacter,
  type CharacterColor,
} from "@/lib/characterColor";
import type { CharacterFrames } from "@/types";
import { cn } from "@/lib/utils";

export function CharacterGenerator({
  onChange,
}: {
  onChange: (frames: CharacterFrames) => void;
}) {
  const t = useT();
  const [selectedColor, setSelectedColor] = useState<CharacterColor>(
    CHARACTER_COLORS[0],
  );
  // Red is the page's default sprite already, so the initial selection
  // does not fire onChange on mount — only user-driven swatch picks do.
  const [previewUrl, setPreviewUrl] = useState(CHARACTER_SPRITE_URL);

  async function handleSelect(color: CharacterColor) {
    setSelectedColor(color);
    const dataUrl = await generateColoredCharacter(color);
    setPreviewUrl(dataUrl);
    onChange(staticCharacterFrames(dataUrl));
  }

  return (
    <div>
      <h3 className="pb-2 text-sm font-medium text-white">
        {t("Select Your Character Color")}:
      </h3>
      <div className="flex w-full items-center justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URL previews are not optimizable by next/image */}
        <img
          src={previewUrl}
          alt=""
          className="h-[38px] w-auto shrink-0"
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          {CHARACTER_COLORS.map((color) => {
            const isSelected = color.value === selectedColor.value;
            return (
              <button
                key={color.value}
                type="button"
                aria-label={color.value}
                onClick={() => void handleSelect(color)}
                className={cn(
                  "h-[38px] w-[38px] cursor-pointer rounded-md",
                  isSelected && "ring-2 ring-white ring-offset-2 ring-offset-black",
                )}
                style={{ background: color.value }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
