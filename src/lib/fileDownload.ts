export function saveOriginalFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Firefox and Safari need time to start reading the URL after activation.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function downloadFilename(response: Response, fallback: string): string {
  const header = response.headers.get("Content-Disposition") ?? "";
  const encoded = header.match(/(?:^|;)\s*filename\*=UTF-8''([^;]+)/i)?.[1];
  const filename = header.match(/(?:^|;)\s*filename=(?:"([^"]*)"|([^;]+))/i);
  let supplied = filename?.[1] ?? filename?.[2];
  if (encoded) {
    try {
      supplied = decodeURIComponent(encoded.trim());
    } catch {
      // A malformed extended filename must not prevent saving the original.
    }
  }
  const name = (supplied || fallback).split(/[\\/]/).pop()?.trim();
  return !name || name === "." || name === ".." ? "download" : name;
}
