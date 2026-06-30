import jsQR from "jsqr";
import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";

const MAX_QR_VALUES = 5;
const MAX_SOURCE_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_SOURCE_IMAGE_BYTES * 4) / 3) + 128;
const MAX_DECODED_PIXELS = 12_000_000;
const MAX_SIDE = 6000;
const MAX_DECODED_VALUE_LENGTH = 500;
const JPEG_MAX_MEMORY_MB = 64;

const DATA_URL_RE = /^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i;
const URL_LIKE_RE =
  /^(?:https?:\/\/|tg:\/\/|ton:\/\/|tonkeeper:\/\/|(?:t\.me|telegram\.me)\/|(?:[a-z0-9-]+\.)+[a-z]{2,})(?:[^\s]*)$/i;

export interface DecodedQrEvidence {
  values: string[];
  urls: string[];
}

interface DecodedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface ImageDimensions {
  width: number;
  height: number;
}

function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  if (dataUrl.length > MAX_DATA_URL_LENGTH) return null;
  const match = dataUrl.trim().match(DATA_URL_RE);
  if (!match) return null;
  try {
    const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
    if (bytes.length > MAX_SOURCE_IMAGE_BYTES) return null;
    return {
      mime: match[1].toLowerCase(),
      bytes,
    };
  } catch {
    return null;
  }
}

function isSafeDimensions({ width, height }: ImageDimensions): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_SIDE &&
    height <= MAX_SIDE &&
    width * height <= MAX_DECODED_PIXELS
  );
}

function readPngDimensions(bytes: Buffer): ImageDimensions | null {
  if (
    bytes.length < 24 ||
    bytes.readUInt32BE(0) !== 0x89504e47 ||
    bytes.readUInt32BE(4) !== 0x0d0a1a0a
  ) {
    return null;
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function readJpegDimensions(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 2 > bytes.length) return null;

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame && segmentLength >= 7) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function decodeImage(dataUrl: string): DecodedImage | null {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  try {
    if (parsed.mime === "image/png") {
      const dimensions = readPngDimensions(parsed.bytes);
      if (!dimensions || !isSafeDimensions(dimensions)) return null;
      const png = PNG.sync.read(parsed.bytes);
      if (!isSafeDimensions(png)) return null;
      return {
        data: new Uint8ClampedArray(png.data),
        width: png.width,
        height: png.height,
      };
    }

    if (parsed.mime === "image/jpeg" || parsed.mime === "image/jpg") {
      const dimensions = readJpegDimensions(parsed.bytes);
      if (!dimensions || !isSafeDimensions(dimensions)) return null;
      const jpeg = decodeJpeg(parsed.bytes, {
        useTArray: true,
        formatAsRGBA: true,
        maxMemoryUsageInMB: JPEG_MAX_MEMORY_MB,
        maxResolutionInMP: MAX_DECODED_PIXELS / 1_000_000,
      });
      if (!isSafeDimensions(jpeg)) return null;
      return {
        data: new Uint8ClampedArray(jpeg.data),
        width: jpeg.width,
        height: jpeg.height,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeDecodedValue(value: string): string | null {
  const cleaned = stripControlChars(value).trim();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, MAX_DECODED_VALUE_LENGTH);
}

function stripControlChars(value: string): string {
  let result = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    result += code < 32 || code === 127 ? " " : char;
  }
  return result;
}

function normalizeUrlLike(value: string): string | null {
  const trimmed = value.trim();
  if (!URL_LIKE_RE.test(trimmed)) return null;
  if (/^(https?|tg|ton|tonkeeper):\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function addQrValue(values: Set<string>, raw: string | null | undefined): void {
  if (!raw || values.size >= MAX_QR_VALUES) return;
  const normalized = normalizeDecodedValue(raw);
  if (normalized) values.add(normalized);
}

function scanQr(data: Uint8ClampedArray, width: number, height: number): string | null {
  if (width < 24 || height < 24) return null;
  try {
    return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
  } catch {
    return null;
  }
}

function cropRgba(
  source: Uint8ClampedArray,
  sourceWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * sourceWidth + x) * 4;
    const sourceEnd = sourceStart + width * 4;
    result.set(source.subarray(sourceStart, sourceEnd), row * width * 4);
  }
  return result;
}

function scanImageTiles(image: DecodedImage): string[] {
  const values = new Set<string>();
  addQrValue(values, scanQr(image.data, image.width, image.height));

  const grids = [2, 3, 4];
  for (const grid of grids) {
    if (values.size >= MAX_QR_VALUES) break;

    const baseTileWidth = Math.ceil(image.width / grid);
    const baseTileHeight = Math.ceil(image.height / grid);
    const overlapX = Math.ceil(baseTileWidth * 0.2);
    const overlapY = Math.ceil(baseTileHeight * 0.2);

    for (let gy = 0; gy < grid; gy += 1) {
      for (let gx = 0; gx < grid; gx += 1) {
        if (values.size >= MAX_QR_VALUES) break;

        const x = Math.max(0, gx * baseTileWidth - overlapX);
        const y = Math.max(0, gy * baseTileHeight - overlapY);
        const right = Math.min(image.width, (gx + 1) * baseTileWidth + overlapX);
        const bottom = Math.min(image.height, (gy + 1) * baseTileHeight + overlapY);
        const width = right - x;
        const height = bottom - y;
        if (width < 80 || height < 80 || (width === image.width && height === image.height)) {
          continue;
        }

        const tile = cropRgba(image.data, image.width, x, y, width, height);
        addQrValue(values, scanQr(tile, width, height));
      }
    }
  }

  return [...values];
}

export function decodeQrFromDataUrl(dataUrl: string): DecodedQrEvidence {
  const image = decodeImage(dataUrl);
  if (!image) return { values: [], urls: [] };

  const values = scanImageTiles(image);
  const urls = [...new Set(values.map(normalizeUrlLike).filter((v): v is string => Boolean(v)))];
  return {
    values,
    urls: urls.slice(0, MAX_QR_VALUES),
  };
}
