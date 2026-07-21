const STORAGE_KEY = "ejector-payment-code";

export function getClientCode(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const code = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, code);
  return code;
}
