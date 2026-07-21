import { canRenderMediaOnWeb } from "@remotion/web-renderer";

export async function checkRenderSupport(): Promise<{
  supported: boolean;
  reason: string | null;
}> {
  try {
    const result = await canRenderMediaOnWeb({
      width: 1920,
      height: 1080,
      container: "mp4",
    });
    if (result.canRender) return { supported: true, reason: null };
    const reason =
      result.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ") || "Rendering is not supported in this browser";
    return { supported: false, reason };
  } catch (error) {
    return {
      supported: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
