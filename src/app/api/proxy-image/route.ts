import { isBlockedHost } from "@/lib/proxyGuard";

// Same-origin image proxy. Replaces the (infra-broken) external
// cors.kassellabs.io proxy: the browser fetches `/api/proxy-image?url=...`
// and this route streams the remote image back with permissive caching, so
// the Image URL / GIF features work without cross-origin taint.

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const TIMEOUT_MS = 10_000;

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Read the upstream body, enforcing the byte cap while buffering (a lying or
 * missing Content-Length can't be trusted). Returns null if the cap is
 * exceeded.
 */
async function readCapped(
  res: Response,
  max: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = res.body?.getReader();
  /* v8 ignore next 4 -- undici always exposes a readable body on a fetch
   * Response; the no-body branch is a defensive fallback. */
  if (!reader) {
    const buffer = await res.arrayBuffer();
    return buffer.byteLength > max ? null : new Uint8Array(buffer);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function GET(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) {
    return errorResponse("Missing url parameter", 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return errorResponse("Invalid url", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return errorResponse("Only http(s) URLs are supported", 400);
  }
  if (isBlockedHost(parsed.hostname)) {
    return errorResponse("Blocked host", 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
  } catch {
    return errorResponse("Upstream fetch failed", 502);
  }

  if (!upstream.ok) {
    return errorResponse("Upstream error", 502);
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return errorResponse("Not an image", 415);
  }

  const declaredLength = upstream.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_BYTES) {
    return errorResponse("Image too large", 413);
  }

  const bytes = await readCapped(upstream, MAX_BYTES);
  if (bytes === null) {
    return errorResponse("Image too large", 413);
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
