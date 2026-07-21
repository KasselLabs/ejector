import { paymentApiUrl } from "@/lib/config";
import type { PaidStatus, PaidTier } from "@/types";

export async function fetchPaidStatus(code: string): Promise<PaidStatus> {
  try {
    const res = await fetch(
      `${paymentApiUrl}/payment/ejector/${encodeURIComponent(code)}/paid`,
    );
    if (!res.ok) return { paid: false };
    return (await res.json()) as PaidStatus;
  } catch {
    return { paid: false };
  }
}

export function tierForDollarValue(v: number | undefined): PaidTier {
  return v !== undefined && v >= 5 ? "full-hd" : "hd";
}
