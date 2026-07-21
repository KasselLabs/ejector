"use client";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PaidTier } from "@/types";

const TIERS: {
  tier: PaidTier;
  nameKey: string;
  priceKey: string;
  items: string[];
}[] = [
  {
    tier: "hd",
    nameKey: "HD Video",
    priceKey: "US$ 3",
    items: ["1280 x 720", "MP4 File", "Includes Watermark"],
  },
  {
    tier: "full-hd",
    nameKey: "Full HD Video",
    priceKey: "US$ 5",
    items: ["1920 x 1080", "MP4 File", "No Watermark"],
  },
];

export function TierPicker({
  selected,
  onSelect,
}: {
  selected: PaidTier;
  onSelect: (tier: PaidTier) => void;
}) {
  const t = useT();

  return (
    <div className="flex items-stretch gap-3">
      {TIERS.map(({ tier, nameKey, priceKey, items }) => {
        const isSelected = selected === tier;
        return (
          <button
            key={tier}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(tier)}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-center text-white outline-none transition-[background,box-shadow,border-color] duration-150",
              "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              isSelected
                ? "border-white bg-white/25 shadow-[0_0_10px_white]"
                : "border-white/60 hover:border-white hover:bg-white/5",
            )}
          >
            <span className="text-base font-semibold">{t(nameKey)}</span>
            <span className="flex flex-col gap-0.5 text-[0.8rem] text-white/70">
              {items.map((item) => (
                <span key={item}>{t(item)}</span>
              ))}
            </span>
            <span className="mt-auto pt-2 text-sm text-white/80">
              {t("Available for")}{" "}
              <b className="text-lg font-semibold text-white">{t(priceKey)}</b>
            </span>
          </button>
        );
      })}
    </div>
  );
}
