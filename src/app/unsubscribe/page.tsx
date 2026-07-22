import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribePage } from "@/components/UnsubscribePage";

export const metadata: Metadata = {
  title: "Unsubscribe – Ejector",
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <UnsubscribePage />
    </Suspense>
  );
}
