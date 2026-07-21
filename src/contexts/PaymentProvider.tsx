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

interface PaymentState {
  paid: boolean;
  tier: PaidTier | null;
  code: string | null;
  refresh: () => Promise<void>;
  /** Unlock immediately. `dollarValue` is DECIMAL DOLLARS (e.g. 5 == $5). */
  markPaid: (dollarValue: number) => void;
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
      setTier(tierForDollarValue(status.dollarValue));
    }
  }, []);

  useEffect(() => {
    // set-state-in-effect is a false positive here: refresh() only calls
    // setState in the async continuation after `await fetchPaidStatus`,
    // never synchronously during the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // `dollarValue` is DECIMAL DOLLARS (payment-frontend's success payload sends
  // finalAmount == amount / 100), so map it through tierForDollarValue.
  const markPaid = useCallback((dollarValue: number) => {
    setPaid(true);
    setTier(tierForDollarValue(dollarValue));
    trackEvent("paid");
  }, []);

  return (
    <PaymentContext.Provider value={{ paid, tier, code, refresh, markPaid }}>
      {children}
    </PaymentContext.Provider>
  );
}

export function usePayment(): PaymentState {
  return useContext(PaymentContext);
}
