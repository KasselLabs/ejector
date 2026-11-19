import { paymentApiUrl } from "@/lib/config";
import { HttpDeliveryError, withRetry } from "@/lib/delivery/retry";
import type { PaidTier } from "@/types";

export interface ServerRenderInput {
  tier: PaidTier;
  color: string;
  ejectedText: string;
  impostorText: string;
}

export type RenderJob =
  | { id: string; status: "queued" | "rendering" | "delivering" | "failed" }
  | {
      id: string;
      status: "ready";
      downloadUrl: string;
      emailStatus?: "pending" | "sent" | "failed";
    };

const storageKey = (code: string) => `ejector-render-job:${code}`;
const jobIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readRenderJobId(code: string): string | null {
  try {
    const id = window.localStorage.getItem(storageKey(code));
    return id && jobIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function saveRenderJobId(code: string, id: string): void {
  try {
    window.localStorage.setItem(storageKey(code), id);
  } catch {
    // The current tab can still check the job when storage is unavailable.
  }
}

export function clearRenderJobId(code: string, id: string): void {
  try {
    if (readRenderJobId(code) === id) {
      window.localStorage.removeItem(storageKey(code));
    }
  } catch {
    // Storage is optional.
  }
}

function validateRenderJob(value: unknown, id: string): RenderJob {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    value.id !== id ||
    !("status" in value)
  ) {
    throw new Error("The render service returned an invalid job.");
  }
  const { status } = value;
  switch (status) {
    case "queued":
    case "rendering":
    case "delivering":
    case "failed":
      return { id, status };
    case "ready": {
      if (!("downloadUrl" in value) || typeof value.downloadUrl !== "string") {
        break;
      }
      const url = new URL(value.downloadUrl);
      if (
        (url.protocol !== "https:" && url.protocol !== "http:") ||
        url.username ||
        url.password
      ) {
        break;
      }
      const email = "emailStatus" in value ? value.emailStatus : undefined;
      const emailStatus = email === "pending" || email === "sent" || email === "failed"
        ? email
        : undefined;
      return { id, status, downloadUrl: url.href, emailStatus };
    }
  }
  throw new Error("The render service returned an invalid job.");
}

export function requestRenderJob(
  code: string,
  id: string,
  signal: AbortSignal,
  input?: ServerRenderInput,
): Promise<RenderJob> {
  const root = `${paymentApiUrl}/payment/ejector/${encodeURIComponent(code)}/render-jobs`;
  const request = input
    ? {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...input }),
        signal,
      }
    : { cache: "no-store" as const, signal };

  return withRetry(
    async () => {
      const response = await fetch(input ? root : `${root}/${id}`, request);
      if (!response.ok) {
        const retryable =
          response.status === 408 || response.status === 429 || response.status >= 500;
        throw new HttpDeliveryError(
          response.status,
          retryable,
          `Server rendering returned status ${response.status}.`,
        );
      }
      return validateRenderJob(await response.json(), id);
    },
    { signal },
  );
}
