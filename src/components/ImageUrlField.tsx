"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useT } from "@/lib/i18n";
import { getCorsUrl } from "@/lib/corsUrl";
import { Input } from "@/components/ui/input";
import { CropDialog } from "@/components/CropDialog";
import type { CharacterFrames } from "@/types";

const DEBOUNCE_MS = 300;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

// Port of legacy ImageURLField's `validateImage`: the URL must both load
// as an image and be fetchable through the CORS proxy (the same proxy the
// crop step will need to read pixel data from it).
async function validateImageUrl(url: string): Promise<void> {
  await loadImage(url);
  const response = await fetch(getCorsUrl(url));
  if (!response.ok) {
    throw new Error(`CORS-proxied fetch failed for: ${url}`);
  }
}

export function ImageUrlField({
  onChange,
}: {
  onChange: (frames: CharacterFrames) => void;
}) {
  const t = useT();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const url = event.target.value;
    setInputValue(url);
    setError("");
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!url) return;

    timerRef.current = setTimeout(() => {
      void validateImageUrl(url)
        .then(() => setPendingImage(url))
        .catch(() => setError(t("Invalid URL")));
    }, DEBOUNCE_MS);
  }

  return (
    <div>
      <Input
        value={inputValue}
        onChange={handleChange}
        placeholder={t("Or Paste a Image URL here")}
        aria-label={t("Image URL")}
        aria-invalid={Boolean(error)}
      />
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      <CropDialog
        image={pendingImage}
        open={pendingImage !== null}
        onClose={() => setPendingImage(null)}
        onChange={(frames) => {
          onChange(frames);
          setPendingImage(null);
          setInputValue("");
        }}
      />
    </div>
  );
}
