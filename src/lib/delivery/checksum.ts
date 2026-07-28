export async function sha256Base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const digestBytes = new Uint8Array(digest);
  let binary = "";

  for (const byte of digestBytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
