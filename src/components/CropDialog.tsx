"use client";

import { useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cropCharacterSource } from "@/lib/cropImage";
import type { CharacterFrames } from "@/types";

// Legacy character sprite aspect ratio (125x162 px).
const CHARACTER_ASPECT = 125 / 162;
const DEFAULT_CROP: Point = { x: 0, y: 0 };

export function CropDialog({
  image,
  open,
  onClose,
  onChange,
  onError,
}: {
  image: string | null;
  open: boolean;
  onClose: () => void;
  onChange: (frames: CharacterFrames) => void;
  onError?: (message: string) => void;
}) {
  const t = useT();
  const [crop, setCrop] = useState<Point>(DEFAULT_CROP);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setCrop(DEFAULT_CROP);
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    if (!image || !croppedAreaPixels) return;
    setIsSubmitting(true);
    try {
      const frames = await cropCharacterSource(
        image,
        croppedAreaPixels,
        rotation,
      );
      onChange(frames);
      handleClose();
    } catch {
      // A failed fetch/crop (e.g. a tainted canvas or unreachable image) must
      // not leave the dialog hanging open with an unhandled rejection: close
      // and surface a translated error to the caller.
      handleClose();
      onError?.(t("Something went wrong. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Crop Image")}</DialogTitle>
        </DialogHeader>
        {image && (
          <div className="relative h-64 w-full overflow-hidden rounded-lg">
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={CHARACTER_ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_croppedArea, areaPixels) =>
                setCroppedAreaPixels(areaPixels)
              }
            />
          </div>
        )}
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <span className="w-16 shrink-0">{t("Zoom")}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <span className="w-16 shrink-0">{t("Rotation")}</span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotation}
              onChange={(event) => setRotation(Number(event.target.value))}
              className="w-full"
            />
          </label>
        </div>
        <DialogFooter>
          <Button
            onClick={() => void handleConfirm()}
            disabled={!croppedAreaPixels || isSubmitting}
          >
            {t("Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
