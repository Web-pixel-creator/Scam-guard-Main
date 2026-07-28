import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import {
  constants as zlibConstants,
  createBrotliCompress,
  createGzip,
  type BrotliOptions,
  type ZlibOptions,
} from "node:zlib";

export type SupportedContentEncoding = "br" | "gzip";

const MINIMUM_KNOWN_BODY_BYTES = 1_024;
const BROTLI_OPTIONS: BrotliOptions = {
  params: {
    [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
  },
};
const GZIP_OPTIONS: ZlibOptions = { level: 6 };

function parseQuality(value: string | undefined): number {
  if (value === undefined) return 1;
  const quality = Number.parseFloat(value);
  if (!Number.isFinite(quality)) return 0;
  return Math.min(1, Math.max(0, quality));
}

function acceptedEncodingQualities(header: string): Map<string, number> {
  const qualities = new Map<string, number>();
  for (const entry of header.split(",")) {
    const [rawName, ...rawParameters] = entry.trim().toLowerCase().split(";");
    const name = rawName?.trim();
    if (!name) continue;
    const qualityParameter = rawParameters
      .map((parameter) => parameter.trim())
      .find((parameter) => parameter.startsWith("q="));
    qualities.set(name, parseQuality(qualityParameter?.slice(2)));
  }
  return qualities;
}

export function selectContentEncoding(
  acceptEncoding: string | null,
): SupportedContentEncoding | null {
  if (!acceptEncoding?.trim()) return null;

  const qualities = acceptedEncodingQualities(acceptEncoding);
  const wildcardQuality = qualities.get("*") ?? 0;
  const candidates = [
    { encoding: "br" as const, quality: qualities.get("br") ?? wildcardQuality },
    { encoding: "gzip" as const, quality: qualities.get("gzip") ?? wildcardQuality },
  ].filter((candidate) => candidate.quality > 0);

  candidates.sort((left, right) => right.quality - left.quality);
  const best = candidates[0];
  if (!best) return null;

  // Identity remains an allowed fallback when omitted, but it only expresses a
  // relative preference when the client assigns it an explicit quality.
  const identityQuality = qualities.get("identity") ?? 0;
  return best.quality >= identityQuality ? best.encoding : null;
}

function isCompressibleContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (mediaType === "text/event-stream") return false;
  if (mediaType.startsWith("text/")) return true;
  if (mediaType.endsWith("+json") || mediaType.endsWith("+xml")) return true;
  return new Set([
    "application/javascript",
    "application/json",
    "application/manifest+json",
    "application/wasm",
    "application/xml",
    "image/svg+xml",
  ]).has(mediaType);
}

function appendVary(headers: Headers, value: string): void {
  const current = headers.get("vary");
  if (!current) {
    headers.set("Vary", value);
    return;
  }
  if (current.trim() === "*") return;
  const values = current.split(",").map((entry) => entry.trim().toLowerCase());
  if (!values.includes(value.toLowerCase())) {
    headers.set("Vary", `${current}, ${value}`);
  }
}

function hasNoTransform(headers: Headers): boolean {
  return (headers.get("cache-control") ?? "")
    .split(",")
    .some((directive) => directive.trim().toLowerCase() === "no-transform");
}

function canCompressResponse(request: Request, response: Response): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.has("range")) return false;
  if (hasNoTransform(request.headers)) return false;
  if (response.status !== 200 || response.body === null) return false;
  if (response.headers.has("content-encoding") || response.headers.has("content-range")) {
    return false;
  }
  if (response.headers.has("set-cookie")) return false;
  if ((response.headers.get("content-disposition") ?? "").toLowerCase().includes("attachment")) {
    return false;
  }
  if (hasNoTransform(response.headers)) return false;
  if (!isCompressibleContentType(response.headers.get("content-type"))) return false;

  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  return !Number.isFinite(contentLength) || contentLength >= MINIMUM_KNOWN_BODY_BYTES;
}

function weakenStrongEtag(headers: Headers): void {
  const etag = headers.get("etag");
  if (etag && !etag.startsWith("W/")) {
    headers.set("ETag", `W/${etag}`);
  }
}

/**
 * Compress eligible GET responses while preserving streaming and security
 * headers. Server actions, ranges, already encoded bodies and `no-transform`
 * responses are deliberately left untouched.
 */
export function compressHttpResponse(request: Request, response: Response): Response {
  if (!canCompressResponse(request, response)) return response;

  const headers = new Headers(response.headers);
  appendVary(headers, "Accept-Encoding");
  const encoding = selectContentEncoding(request.headers.get("accept-encoding"));
  if (!encoding) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const source = Readable.fromWeb(response.body as unknown as NodeReadableStream);
  const compressor =
    encoding === "br" ? createBrotliCompress(BROTLI_OPTIONS) : createGzip(GZIP_OPTIONS);
  const body = Readable.toWeb(source.pipe(compressor)) as ReadableStream<Uint8Array>;

  headers.set("Content-Encoding", encoding);
  headers.delete("Content-Length");
  headers.delete("Content-MD5");
  headers.delete("Digest");
  headers.delete("Accept-Ranges");
  weakenStrongEtag(headers);

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
