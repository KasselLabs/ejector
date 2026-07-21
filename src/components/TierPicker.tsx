"use client";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PaidTier } from "@/types";

const TIERS: {
  tier: PaidTier;
  nameKey: string;
  priceKey: string;
  watermarkKey: string;
}[] = [
  {
    tier: "hd",
    nameKey: "HD Video",
    priceKey: "US$ 3",
    watermarkKey: "Includes Watermark",
  },
  {
    tier: "full-hd",
    nameKey: "Full HD Video",
    priceKey: "US$ 5",
    watermarkKey: "No Watermark",
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
    <div className="grid grid-cols-2 gap-3">
      {TIERS.map(({ tier, nameKey, priceKey, watermarkKey }) => (
        <button
          key={tier}
          type="button"
          aria-pressed={selected === tier}
          onClick={() => onSelect(tier)}
          className={cn(
            "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
            selected === tier
              ? "border-primary bg-primary/10"
              : "border-white/10 hover:border-white/20",
          )}
        >
          <span className="font-heading text-sm font-medium">
            {t(nameKey)}
          </span>
          <span className="text-lg font-semibold">{t(priceKey)}</span>
          <span className="text-xs text-white/50">{t("MP4 File")}</span>
          <span className="text-xs text-white/50">{t(watermarkKey)}</span>
        </button>
      ))}
    </div>
  );
}
