import { adminGraphqlUrl } from "@/lib/config";

async function graphqlRequest(
  query: string,
  variables: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(adminGraphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const body = (await res.json()) as { errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors[0].message);
}

export async function subscribeNewsletter(
  email: string,
  language: string,
): Promise<void> {
  await graphqlRequest(
    `mutation ($input: SubscribeNewsletterInput!) {
      subscribeNewsletter(input: $input) { id }
    }`,
    { input: { email, source: "ejector", language } },
  );
}

export async function unsubscribeNewsletter(email: string): Promise<void> {
  await graphqlRequest(
    `mutation ($input: UnsubscribeNewsletterInput!) {
      unsubscribeNewsletter(input: $input) { id }
    }`,
    { input: { email } },
  );
}
