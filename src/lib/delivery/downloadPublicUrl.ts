export function downloadPublicUrl(url: string, filename: string): void {
  let publicUrl: URL;
  try {
    publicUrl = new URL(url);
  } catch {
    throw new TypeError("Video delivery returned an invalid download URL.");
  }
  if (
    (publicUrl.protocol !== "https:" && publicUrl.protocol !== "http:") ||
    publicUrl.username !== "" ||
    publicUrl.password !== ""
  ) {
    throw new TypeError("Video delivery returned an unsafe download URL.");
  }

  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = publicUrl.href;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
  }
}
