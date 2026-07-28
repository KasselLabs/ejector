export function downloadPublicUrl(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
