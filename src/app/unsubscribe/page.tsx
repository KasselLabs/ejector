import { Suspense } from "react";
import { UnsubscribePage } from "@/components/UnsubscribePage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <UnsubscribePage />
    </Suspense>
  );
}
