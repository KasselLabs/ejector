"use client";

import { ZoomIn, RotateCw } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Zoom + rotation slider rows for the CropDialog: each row has a lucide icon,
 * a translated label, a full-width themed range input (enlarged touch thumb on
 * mobile via the `.crop-range` class) and a live value readout.
 */
export function CropControls({
  zoom,
  rotation,
  minZoom,
  maxZoom,
  onZoomChange,
  onRotationChange,
}: {
  zoom: number;
  rotation: number;
  minZoom: number;
  maxZoom: number;
  onZoomChange: (value: number) => void;
  onRotationChange: (value: number) => void;
}) {
  const t = useT();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <ZoomIn className="size-5 shrink-0 text-white/70" aria-hidden />
        <label
          htmlFor="crop-zoom"
          className="w-20 shrink-0 text-sm text-white/80"
        >
          {t("Zoom")}
        </label>
        <input
          id="crop-zoom"
          type="range"
          className="crop-range"
          min={minZoom}
          max={maxZoom}
          step={0.01}
          value={zoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
          aria-label={t("Zoom")}
        />
        <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-white/60">
          {zoom.toFixed(2)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <RotateCw className="size-5 shrink-0 text-white/70" aria-hidden />
        <label
          htmlFor="crop-rotation"
          className="w-20 shrink-0 text-sm text-white/80"
        >
          {t("Rotation")}
        </label>
        <input
          id="crop-rotation"
          type="range"
          className="crop-range"
          min={-180}
          max={180}
          step={1}
          value={rotation}
          onChange={(event) => onRotationChange(Number(event.target.value))}
          aria-label={t("Rotation")}
        />
        <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-white/60">
          {rotation.toFixed(0)}°
        </span>
      </div>
    </div>
  );
}
