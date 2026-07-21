import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { GIFEncoder } from "gifenc";
import { server } from "@/test/msw/server";
import { decodeGifToCharacterFrames } from "./gifFrames";

const FIXTURE_URL = "http://gif-fixture.test/test.gif";
// decodeGifToCharacterFrames fetches through getCorsUrl's same-origin proxy,
// so the mock handler matches `/api/proxy-image?url=<encoded source>`.
const ENCODED_FIXTURE_URL = encodeURIComponent(FIXTURE_URL);

// Builds a real, tiny animated GIF (2x2px, two frames) so the pipeline
// under test runs through real gifuct-js decoding rather than mocked
// frame data. Frame 0 uses disposalType 2 ("restore to background", the
// only disposal type the production code branches on); frame 1 uses the
// default disposal (0) and an under-threshold delay so the same fixture
// also exercises normalizeGifDelays' fallback inline in the full pipeline.
function buildTestGif(): Uint8Array {
  const width = 2;
  const height = 2;
  const palette: [number, number, number][] = [
    [255, 0, 0],
    [0, 255, 0],
  ];
  const encoder = GIFEncoder();
  encoder.writeFrame(new Uint8Array([0, 0, 0, 0]), width, height, {
    palette,
    delay: 50,
    dispose: 2,
    first: true,
  });
  encoder.writeFrame(new Uint8Array([1, 1, 1, 1]), width, height, {
    palette,
    delay: 0,
  });
  encoder.finish();
  return encoder.bytes();
}

describe("decodeGifToCharacterFrames", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("decodes a real GIF into full-frame PNG data URLs with accumulated timings", async () => {
    const bytes = buildTestGif();
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    server.use(
      http.get("*/api/proxy-image", ({ request }) => {
        // The source URL is passed as the encoded `url` query param.
        expect(new URL(request.url).searchParams.get("url")).toBe(FIXTURE_URL);
        expect(request.url).toContain(ENCODED_FIXTURE_URL);
        return HttpResponse.arrayBuffer(arrayBuffer, {
          headers: { "Content-Type": "image/gif" },
        });
      }),
    );

    const result = await decodeGifToCharacterFrames(FIXTURE_URL);

    // Frame 0's 50ms delay is untouched (above the 20ms threshold); frame
    // 1's 0ms delay is normalized to the 100ms legacy fallback -- so the
    // total is 150ms, not 50ms.
    expect(result.durationSeconds).toBeCloseTo(0.15);
    expect(result.frames).toHaveLength(2);

    expect(result.frames[0].startSeconds).toBe(0);
    expect(result.frames[0].endSeconds).toBeCloseTo(0.05);
    expect(result.frames[0].imageUrl).toMatch(/^data:image\/png/);

    expect(result.frames[1].startSeconds).toBeCloseTo(0.05);
    expect(result.frames[1].endSeconds).toBeCloseTo(0.15);
    expect(result.frames[1].imageUrl).toMatch(/^data:image\/png/);
  });
});
