import { parseAllowedImageDataUrl } from "./risk/media-data-url";

// Shared browser/server binding only. Unlike identifier normalization, base64
// is case-sensitive. Neither the image nor this transient digest is persisted.
export async function digestWebOcrImage(dataUrl: string): Promise<string> {
  const image = parseAllowedImageDataUrl(dataUrl);
  if (!image) throw new Error("invalid_image_data_url");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(image.dataUrl));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
