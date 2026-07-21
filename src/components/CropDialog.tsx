"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area, type Point, type MediaSize } from "react-easy-crop";
import {
  MoveHorizontal,
  MoveVertical,
  Shrink,
  Expand,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CropControls } from "@/components/CropControls";
import { useT } from "@/lib/i18n";
import { cropCharacterSource } from "@/lib/cropImage";
import { trackEvent } from "@/lib/tracking";
import type { CharacterFrames } from "@/types";

// Legacy parity: square crop, 240×240 crop box, position unrestricted so the
// image can be dragged partially outside the crop area.
const CROP_SIZE = { width: 240, height: 240 };
const DEFAULT_CROP: Point = { x: 0, y: 0 };
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

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
  const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) trackEvent("crop_image_modal_open");
  }, [open]);

  function reset() {
    setCrop(DEFAULT_CROP);
    setZoom(1);
    setRotation(0);
    setMediaSize(null);
    setCroppedAreaPixels(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Legacy fit/fill: derive the zoom that fits the whole image inside the crop
  // box (min ratio) or fills the box (max ratio), reset rotation and recenter.
  function applyZoomRatio(pick: (a: number, b: number) => number) {
    if (!mediaSize) return;
    const widthRatio = CROP_SIZE.width / mediaSize.width;
    const heightRatio = CROP_SIZE.height / mediaSize.height;
    setZoom(pick(widthRatio, heightRatio));
    setRotation(0);
    setCrop(DEFAULT_CROP);
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
      trackEvent("crop_image_completed");
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

  const quickActions = [
    {
      key: "center-h",
      label: t("Center the image horizontally"),
      icon: MoveHorizontal,
      onClick: () => setCrop((prev) => ({ ...prev, x: 0 })),
    },
    {
      key: "center-v",
      label: t("Center the image vertically"),
      icon: MoveVertical,
      onClick: () => setCrop((prev) => ({ ...prev, y: 0 })),
    },
    {
      key: "fit",
      label: t("Fits the image inside the crop area"),
      icon: Shrink,
      onClick: () => applyZoomRatio(Math.min),
    },
    {
      key: "fill",
      label: t("Fill the crop area with the image"),
      icon: Expand,
      onClick: () => applyZoomRatio(Math.max),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        className="flex max-h-[100dvh] flex-col gap-3 border border-white bg-black text-white sm:max-w-lg max-sm:inset-0 max-sm:h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:top-0 max-sm:left-0"
      >
        <DialogHeader>
          <DialogTitle>{t("Crop Image")}</DialogTitle>
        </DialogHeader>

        {image && (
          <div className="relative min-h-[280px] w-full flex-1 overflow-hidden rounded-lg bg-black sm:h-[58vh] sm:min-h-[58vh] sm:flex-none">
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropSize={CROP_SIZE}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              restrictPosition={false}
              zoomWithScroll
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onMediaLoaded={setMediaSize}
              onCropComplete={(_area, areaPixels) =>
                setCroppedAreaPixels(areaPixels)
              }
            />

            {mediaSize && (
              <div className="absolute bottom-2 left-2 flex flex-col gap-2">
                {quickActions.map(({ key, label, icon: Icon, onClick }) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={onClick}
                    className="grid size-11 place-items-center rounded-md border border-white/80 bg-black/70 text-white backdrop-blur transition-colors hover:bg-white/20"
                  >
                    <Icon className="size-5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-white/50">
          {t("Drag to position · pinch or scroll to zoom")}
        </p>

        <CropControls
          zoom={zoom}
          rotation={rotation}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
        />

        <div className="mt-1 flex gap-3 max-sm:sticky max-sm:bottom-0 max-sm:bg-black max-sm:pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="min-h-11 flex-1 uppercase tracking-wide"
          >
            {t("Close")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!croppedAreaPixels || isSubmitting}
            className="min-h-11 flex-1 uppercase tracking-wide"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                {t("Loading")}
                <Loader2 className="size-4 animate-spin" />
              </span>
            ) : (
              t("Confirm")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
