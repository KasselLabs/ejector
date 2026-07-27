"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { PaidTier } from "@/types";
import { getClientCode } from "@/lib/payment/clientCode";
import {
  fetchPaidStatus,
  tierForDollarValue,
} from "@/lib/payment/paidStatus";
import { trackEvent } from "@/lib/tracking";

const PAID_TIER_STORAGE_KEY = "ejector-payment-tier";

function storedTierForCode(code: string): PaidTier | null {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(PAID_TIER_STORAGE_KEY) ?? "null",
    ) as { code?: unknown; tier?: unknown } | null;
    if (
      stored?.code === code &&
      (stored.tier === "hd" || stored.tier === "full-hd")
    ) {
      return stored.tier;
    }
  } catch {
    // Ignore malformed or unavailable browser storage and use backend data.
  }
  return null;
}

function storeTier(code: string, tier: PaidTier): void {
  try {
    window.localStorage.setItem(
      PAID_TIER_STORAGE_KEY,
      JSON.stringify({ code, tier }),
    );
  } catch {
    // The current session remains unlocked even if storage is unavailable.
  }
}

interface PaymentState {
  paid: boolean;
  tier: PaidTier | null;
  code: string | null;
  refresh: () => Promise<void>;
  /** Unlock immediately. `dollarValue` is DECIMAL DOLLARS (e.g. 5 == $5). */
  markPaid: (dollarValue: number, purchasedTier?: PaidTier) => void;
}

const PaymentContext = createContext<PaymentState>({
  paid: false,
  tier: null,
  code: null,
  refresh: async () => {},
  markPaid: () => {},
});

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const [paid, setPaid] = useState(false);
  const [tier, setTier] = useState<PaidTier | null>(null);
  // Seed `code` synchronously from localStorage so the payment iframe never
  // opens with a null/absent code (which would orphan the 24h window). Guarded
  // for SSR, where `window` is undefined; the effect below fills it in on the
  // client if the lazy initializer ran server-side.
  const [code, setCode] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getClientCode(),
  );

  // Client-side fallback: keep hydration consistent by seeding the code after
  // mount when the SSR initializer produced null.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!code) setCode(getClientCode());
  }, [code]);

  // All setState calls must occur after the await to satisfy react-hooks/set-state-in-effect.
  const refresh = useCallback(async () => {
    const clientCode = getClientCode();
    const status = await fetchPaidStatus(clientCode);
    setCode(clientCode);
    if (status.paid) {
      setPaid(true);
      setTier(
        storedTierForCode(clientCode) ??
          tierForDollarValue(status.dollarValue),
      );
    }
  }, []);

  useEffect(() => {
    // set-state-in-effect is a false positive here: refresh() only calls
    // setState in the async continuation after `await fetchPaidStatus`,
    // never synchronously during the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Prefer the tier explicitly selected in checkout. `dollarValue` remains the
  // fallback for restored sessions that predate local tier persistence.
  const markPaid = useCallback(
    (dollarValue: number, purchasedTier?: PaidTier) => {
      const resolvedTier = purchasedTier ?? tierForDollarValue(dollarValue);
      setPaid(true);
      setTier(resolvedTier);
      storeTier(getClientCode(), resolvedTier);
      trackEvent("paid");
    },
    [],
  );

  return (
    <PaymentContext.Provider value={{ paid, tier, code, refresh, markPaid }}>
      {children}
    </PaymentContext.Provider>
  );
}

export function usePayment(): PaymentState {
  return useContext(PaymentContext);
}
