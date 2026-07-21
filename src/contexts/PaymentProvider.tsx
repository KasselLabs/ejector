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
  tierForCents,
  tierForDollarValue,
} from "@/lib/payment/paidStatus";
import { trackEvent } from "@/lib/tracking";

interface PaymentState {
  paid: boolean;
  tier: PaidTier | null;
  code: string | null;
  refresh: () => Promise<void>;
  markPaid: (finalAmountCents: number) => void;
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
  const [code, setCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const clientCode = getClientCode();
    setCode(clientCode);
    const status = await fetchPaidStatus(clientCode);
    if (status.paid) {
      setPaid(true);
      setTier(tierForDollarValue(status.dollarValue));
    }
  }, []);

  useEffect(() => {
    const initPayment = async () => {
      const clientCode = getClientCode();
      setCode(clientCode);
      const status = await fetchPaidStatus(clientCode);
      if (status.paid) {
        setPaid(true);
        setTier(tierForDollarValue(status.dollarValue));
      }
    };
    void initPayment();
  }, []);

  const markPaid = useCallback((finalAmountCents: number) => {
    setPaid(true);
    setTier(tierForCents(finalAmountCents));
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
