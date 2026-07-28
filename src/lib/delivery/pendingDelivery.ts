import type { DeliveryTier } from "./types";

const STORAGE_KEY = "ejector-pending-delivery";
const DELIVERY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PendingDeliveryRecord {
  deliveryId: string;
  tier: DeliveryTier;
  filename: string;
}

const isPendingDeliveryRecord = (
  value: unknown,
): value is PendingDeliveryRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return (
    keys.length === 3 &&
    keys[0] === "deliveryId" &&
    keys[1] === "filename" &&
    keys[2] === "tier" &&
    typeof record.deliveryId === "string" &&
    DELIVERY_ID_PATTERN.test(record.deliveryId) &&
    (record.tier === "hd" || record.tier === "full-hd") &&
    typeof record.filename === "string" &&
    record.filename.length > 0 &&
    record.filename.length <= 1024 &&
    record.filename.endsWith(".mp4")
  );
};

export function savePendingDelivery(record: PendingDeliveryRecord): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        deliveryId: record.deliveryId,
        tier: record.tier,
        filename: record.filename,
      }),
    );
  } catch {
    // In-memory delivery still works when browser storage is unavailable.
  }
}

export function clearPendingDelivery(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Treat unavailable browser storage as already cleared.
  }
}

export function readPendingDelivery(): PendingDeliveryRecord | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (isPendingDeliveryRecord(parsed)) return parsed;
  } catch {
    // Malformed or unavailable storage cannot be recovered safely.
  }

  clearPendingDelivery();
  return null;
}
