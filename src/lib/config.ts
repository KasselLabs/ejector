function stripSlash(v: string | undefined, fallback: string): string {
  return (v ?? fallback).replace(/\/+$/, "");
}

export const paymentPageUrl = stripSlash(
  process.env.NEXT_PUBLIC_PAYMENT_PAGE_URL,
  "https://payment.kassellabs.io",
);
export const paymentApiUrl = stripSlash(
  process.env.NEXT_PUBLIC_PAYMENT_API_URL,
  "",
);
export const adminGraphqlUrl = stripSlash(
  process.env.NEXT_PUBLIC_ADMIN_GRAPHQL_URL,
  "https://admin.kassellabs.io/graphql",
);
export const gaId = process.env.NEXT_PUBLIC_GA_ID ?? "";
