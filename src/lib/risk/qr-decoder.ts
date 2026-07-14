import { Worker } from "node:worker_threads";

const MAX_SOURCE_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_SOURCE_IMAGE_BYTES * 4) / 3) + 128;
const MAX_PENDING_QR_JOBS = 4;
const QR_DECODE_DEADLINE_MS = 900;

export interface DecodedQrEvidence {
  values: string[];
  urls: string[];
}

interface QrDecodeJob {
  id: number;
  dataUrl: string;
  resolve: (result: DecodedQrEvidence) => void;
  timer?: ReturnType<typeof setTimeout>;
}

interface WorkerReply {
  id: number;
  result: DecodedQrEvidence;
}

// The worker owns all untrusted base64 parsing, PNG/JPEG expansion and jsQR
// work. Keeping the source self-contained makes the isolation work in both the
// Vitest source runtime and the bundled Node server without relying on a
// deployment-specific path to a second compiled module.
const QR_WORKER_SOURCE = String.raw`
const { parentPort } = require("node:worker_threads");
const jsQrModule = require("jsqr");
const jsQR = jsQrModule.default || jsQrModule;
const { decode: decodeJpeg } = require("jpeg-js");
const { PNG } = require("pngjs");
const { performance } = require("node:perf_hooks");

const MAX_QR_VALUES = 5;
const MAX_SOURCE_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_SOURCE_IMAGE_BYTES * 4) / 3) + 128;
const MAX_DECODED_PIXELS = 4_000_000;
const MAX_SIDE = 4096;
const MAX_SCAN_PIXELS = 1_500_000;
const MAX_SCAN_SIDE = 2000;
const MAX_SCAN_ATTEMPTS = 5;
const MAX_SCAN_WORK_MS = 350;
const MAX_DECODED_VALUE_LENGTH = 500;
const JPEG_MAX_MEMORY_MB = 64;

const DATA_URL_RE = /^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i;
const URL_LIKE_RE = /^(?:https?:\/\/|tg:\/\/|ton:\/\/|tonkeeper:\/\/|(?:t\.me|telegram\.me)\/|(?:[a-z0-9-]+\.)+[a-z]{2,})(?:[^\s]*)$/i;

function emptyEvidence() {
  return { values: [], urls: [] };
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_DATA_URL_LENGTH) return null;
  const match = dataUrl.trim().match(DATA_URL_RE);
  if (!match) return null;
  try {
    const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
    if (bytes.length > MAX_SOURCE_IMAGE_BYTES) return null;
    return { mime: match[1].toLowerCase(), bytes };
  } catch {
    return null;
  }
}

function isSafeDimensions({ width, height }) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= MAX_SIDE && height <= MAX_SIDE && width * height <= MAX_DECODED_PIXELS;
}

function readPngDimensions(bytes) {
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47 || bytes.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function readJpegDimensions(bytes) {
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
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += segmentLength;
  }
  return null;
}

function decodeImage(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  try {
    if (parsed.mime === "image/png") {
      const dimensions = readPngDimensions(parsed.bytes);
      if (!dimensions || !isSafeDimensions(dimensions)) return null;
      const png = PNG.sync.read(parsed.bytes);
      if (!isSafeDimensions(png)) return null;
      return { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height };
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
      return { data: new Uint8ClampedArray(jpeg.data), width: jpeg.width, height: jpeg.height };
    }
  } catch {
    return null;
  }
  return null;
}

function resizeForScanning(image) {
  const pixelScale = Math.sqrt(MAX_SCAN_PIXELS / (image.width * image.height));
  const scale = Math.min(1, pixelScale, MAX_SCAN_SIDE / image.width, MAX_SCAN_SIDE / image.height);
  if (scale >= 1) return image;
  const width = Math.max(1, Math.floor(image.width * scale));
  const height = Math.max(1, Math.floor(image.height * scale));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor(x / scale));
      const sourceOffset = (sourceY * image.width + sourceX) * 4;
      const targetOffset = (y * width + x) * 4;
      data[targetOffset] = image.data[sourceOffset];
      data[targetOffset + 1] = image.data[sourceOffset + 1];
      data[targetOffset + 2] = image.data[sourceOffset + 2];
      data[targetOffset + 3] = image.data[sourceOffset + 3];
    }
  }
  return { data, width, height };
}

function stripControlChars(value) {
  let result = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    result += code < 32 || code === 127 ? " " : char;
  }
  return result;
}

function normalizeDecodedValue(value) {
  const cleaned = stripControlChars(value).trim();
  return cleaned.length === 0 ? null : cleaned.slice(0, MAX_DECODED_VALUE_LENGTH);
}

function normalizeUrlLike(value) {
  const trimmed = value.trim();
  if (!URL_LIKE_RE.test(trimmed)) return null;
  if (/^(https?|tg|ton|tonkeeper):\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

function addQrValue(values, raw) {
  if (!raw || values.size >= MAX_QR_VALUES) return;
  const normalized = normalizeDecodedValue(raw);
  if (normalized) values.add(normalized);
}

function scanQr(data, width, height) {
  if (width < 24 || height < 24) return null;
  try {
    const result = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
    return result ? result.data : null;
  } catch {
    return null;
  }
}

function cropRgba(source, sourceWidth, x, y, width, height) {
  const result = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * sourceWidth + x) * 4;
    result.set(source.subarray(sourceStart, sourceStart + width * 4), row * width * 4);
  }
  return result;
}

function scanImageTiles(decodedImage) {
  const image = resizeForScanning(decodedImage);
  const values = new Set();
  const startedAt = performance.now();
  let attempts = 0;

  addQrValue(values, scanQr(image.data, image.width, image.height));
  attempts += 1;

  const grid = 2;
  const baseTileWidth = Math.ceil(image.width / grid);
  const baseTileHeight = Math.ceil(image.height / grid);
  const overlapX = Math.ceil(baseTileWidth * 0.15);
  const overlapY = Math.ceil(baseTileHeight * 0.15);

  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      if (values.size >= MAX_QR_VALUES || attempts >= MAX_SCAN_ATTEMPTS || performance.now() - startedAt >= MAX_SCAN_WORK_MS) return [...values];
      const x = Math.max(0, gx * baseTileWidth - overlapX);
      const y = Math.max(0, gy * baseTileHeight - overlapY);
      const right = Math.min(image.width, (gx + 1) * baseTileWidth + overlapX);
      const bottom = Math.min(image.height, (gy + 1) * baseTileHeight + overlapY);
      const width = right - x;
      const height = bottom - y;
      if (width < 80 || height < 80 || (width === image.width && height === image.height)) continue;
      const tile = cropRgba(image.data, image.width, x, y, width, height);
      addQrValue(values, scanQr(tile, width, height));
      attempts += 1;
    }
  }
  return [...values];
}

function decodeQr(dataUrl) {
  const image = decodeImage(dataUrl);
  if (!image) return emptyEvidence();
  const values = scanImageTiles(image);
  const urls = [...new Set(values.map(normalizeUrlLike).filter(Boolean))];
  return { values, urls: urls.slice(0, MAX_QR_VALUES) };
}

parentPort.on("message", ({ id, dataUrl }) => {
  let result = emptyEvidence();
  try {
    result = decodeQr(dataUrl);
  } catch {
    result = emptyEvidence();
  }
  parentPort.postMessage({ id, result });
});
`;

function emptyEvidence(): DecodedQrEvidence {
  return { values: [], urls: [] };
}

function coerceWorkerResult(value: unknown): DecodedQrEvidence {
  if (!value || typeof value !== "object") return emptyEvidence();
  const candidate = value as Partial<DecodedQrEvidence>;
  const values = Array.isArray(candidate.values)
    ? candidate.values.filter((item): item is string => typeof item === "string").slice(0, 5)
    : [];
  const urls = Array.isArray(candidate.urls)
    ? candidate.urls.filter((item): item is string => typeof item === "string").slice(0, 5)
    : [];
  return { values, urls };
}

class QrDecodeWorkerPool {
  private worker: Worker | null = null;
  private current: QrDecodeJob | null = null;
  private readonly queue: QrDecodeJob[] = [];
  private nextId = 1;

  decode(dataUrl: string): Promise<DecodedQrEvidence> {
    if (
      typeof dataUrl !== "string" ||
      dataUrl.length > MAX_DATA_URL_LENGTH ||
      !/^data:image\/(?:png|jpe?g);base64,/i.test(dataUrl.trim())
    ) {
      return Promise.resolve(emptyEvidence());
    }

    if (this.queue.length + (this.current ? 1 : 0) >= MAX_PENDING_QR_JOBS) {
      return Promise.resolve(emptyEvidence());
    }

    return new Promise((resolve) => {
      this.queue.push({ id: this.nextId++, dataUrl, resolve });
      this.dispatch();
    });
  }

  async terminateForOperationsProbe(): Promise<boolean> {
    const worker = this.worker;
    if (!worker) return false;
    await worker.terminate();
    return true;
  }

  private createWorker(): Worker {
    const worker = new Worker(QR_WORKER_SOURCE, {
      eval: true,
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 16,
        stackSizeMb: 4,
      },
    });

    worker.on("message", (reply: WorkerReply) => {
      if (this.worker !== worker || !this.current || reply?.id !== this.current.id) return;
      const job = this.current;
      this.current = null;
      if (job.timer) clearTimeout(job.timer);
      job.resolve(coerceWorkerResult(reply.result));
      this.dispatch();
    });

    const failCurrent = () => {
      if (this.worker !== worker) return;
      this.worker = null;
      const job = this.current;
      this.current = null;
      if (job?.timer) clearTimeout(job.timer);
      job?.resolve(emptyEvidence());
      this.dispatch();
    };

    worker.on("error", failCurrent);
    worker.on("exit", failCurrent);
    return worker;
  }

  private dispatch(): void {
    if (this.current) return;
    const job = this.queue.shift();
    if (!job) {
      this.worker?.unref();
      return;
    }

    if (!this.worker) this.worker = this.createWorker();
    const worker = this.worker;
    worker.ref();
    this.current = job;
    job.timer = setTimeout(() => {
      if (this.current?.id !== job.id || this.worker !== worker) return;
      this.current = null;
      this.worker = null;
      job.resolve(emptyEvidence());
      void worker.terminate();
      this.dispatch();
    }, QR_DECODE_DEADLINE_MS);
    worker.postMessage({ id: job.id, dataUrl: job.dataUrl });
  }
}

const qrDecodePool = new QrDecodeWorkerPool();

export async function decodeQrFromDataUrl(dataUrl: string): Promise<DecodedQrEvidence> {
  return qrDecodePool.decode(dataUrl);
}

// Internal operations hook used only by the isolated resource/crash harness.
// It is not connected to an HTTP, Telegram or client-callable path.
export async function terminateQrDecodeWorkerForOperationsProbe(): Promise<boolean> {
  return qrDecodePool.terminateForOperationsProbe();
}
