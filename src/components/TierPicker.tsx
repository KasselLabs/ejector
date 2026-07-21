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
    <div className="flex gap-3">
      {TIERS.map(({ tier, nameKey, priceKey, items }) => (
        <button
          key={tier}
          type="button"
          aria-pressed={selected === tier}
          onClick={() => onSelect(tier)}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center rounded border border-white bg-transparent p-2 text-white outline-none transition-[background,box-shadow] duration-150",
            selected === tier &&
              "bg-white/25 shadow-[0_0_10px_white]",
          )}
        >
          <span className="mb-1 text-lg font-bold">{t(nameKey)}</span>
          {items.map((item) => (
            <span key={item} className="text-[0.95em]">
              {t(item)}
            </span>
          ))}
          <span className="mt-2 text-[1.1em]">
            {t("Available for")} <b>{t(priceKey)}</b>
          </span>
        </button>
      ))}
    </div>
  );
}
