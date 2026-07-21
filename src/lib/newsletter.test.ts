import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { subscribeNewsletter, unsubscribeNewsletter } from "./newsletter";

describe("subscribeNewsletter", () => {
  it("posts a subscribeNewsletter mutation with email/source/language", async () => {
    let capturedBody: {
      query: string;
      variables: Record<string, unknown>;
    } | null = null;
    server.use(
      http.post("*/graphql", async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({
          data: { subscribeNewsletter: { id: "1" } },
        });
      }),
    );

    await expect(
      subscribeNewsletter("test@example.com", "en"),
    ).resolves.toBeUndefined();

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.query).toContain("subscribeNewsletter");
    expect(capturedBody!.variables).toEqual({
      input: { email: "test@example.com", source: "ejector", language: "en" },
    });
  });

  it("rejects when the GraphQL response contains errors", async () => {
    server.use(
      http.post("*/graphql", () =>
        HttpResponse.json({
          errors: [{ message: "Email already subscribed" }],
        }),
      ),
    );

    await expect(
      subscribeNewsletter("test@example.com", "en"),
    ).rejects.toThrow("Email already subscribed");
  });

  it("rejects on HTTP error", async () => {
    server.use(
      http.post("*/graphql", () => HttpResponse.json({}, { status: 500 })),
    );

    await expect(
      subscribeNewsletter("test@example.com", "en"),
    ).rejects.toThrow("GraphQL HTTP 500");
  });
});

describe("unsubscribeNewsletter", () => {
  it("posts an unsubscribeNewsletter mutation with the email", async () => {
    let capturedBody: {
      query: string;
      variables: Record<string, unknown>;
    } | null = null;
    server.use(
      http.post("*/graphql", async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({
          data: { unsubscribeNewsletter: { id: "1" } },
        });
      }),
    );

    await expect(
      unsubscribeNewsletter("test@example.com"),
    ).resolves.toBeUndefined();

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.query).toContain("unsubscribeNewsletter");
    expect(capturedBody!.variables).toEqual({
      input: { email: "test@example.com" },
    });
  });

  it("rejects when the GraphQL response contains errors", async () => {
    server.use(
      http.post("*/graphql", () =>
        HttpResponse.json({ errors: [{ message: "Not subscribed" }] }),
      ),
    );

    await expect(unsubscribeNewsletter("test@example.com")).rejects.toThrow(
      "Not subscribed",
    );
  });
});
