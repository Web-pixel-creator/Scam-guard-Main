export const MAX_IMAGE_DATA_URL_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_DATA_URL_LENGTH = Math.ceil((MAX_IMAGE_DATA_URL_BYTES * 4) / 3) + 128;

export const ALLOWED_IMAGE_DATA_URL_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

type AllowedImageDataUrlMimeType = (typeof ALLOWED_IMAGE_DATA_URL_MIME_TYPES)[number];

export interface AllowedImageDataUrl {
  dataUrl: string;
  mimeType: AllowedImageDataUrlMimeType;
  base64: string;
  byteLength: number;
}

interface ImageDataUrlOptions {
  maxBytes?: number;
}

const DATA_URL_RE = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function isAllowedImageMimeType(mimeType: string): mimeType is AllowedImageDataUrlMimeType {
  return ALLOWED_IMAGE_DATA_URL_MIME_TYPES.includes(mimeType as AllowedImageDataUrlMimeType);
}

function decodedBase64Length(base64: string): number | null {
  if (!BASE64_RE.test(base64) || base64.length % 4 !== 0) return null;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

export function parseAllowedImageDataUrl(
  value: string,
  options: ImageDataUrlOptions = {},
): AllowedImageDataUrl | null {
  const maxBytes = options.maxBytes ?? MAX_IMAGE_DATA_URL_BYTES;
  const maxLength = Math.ceil((maxBytes * 4) / 3) + 128;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return null;

  const match = DATA_URL_RE.exec(trimmed);
  if (!match) return null;

  const mimeType = match[1].trim().toLowerCase();
  if (!isAllowedImageMimeType(mimeType)) return null;

  const base64 = match[2].replace(/\s+/g, "");
  const byteLength = decodedBase64Length(base64);
  if (byteLength === null || byteLength <= 0 || byteLength > maxBytes) return null;

  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
    base64,
    byteLength,
  };
}
