import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import {
  constants as zlibConstants,
  createBrotliCompress,
  createGzip,
  type BrotliOptions,
  type ZlibOptions,
} from "node:zlib";

export type SupportedContentEncoding = "br" | "gzip";

type ContentEncodingNegotiation = {
  encoding: SupportedContentEncoding | null;
  identityAcceptable: boolean;
};

const MINIMUM_KNOWN_BODY_BYTES = 1_024;
const BROTLI_OPTIONS: BrotliOptions = {
  params: {
    [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
  },
};
const GZIP_OPTIONS: ZlibOptions = { level: 6 };

function parseQuality(value: string | undefined): number {
  if (value === undefined) return 1;
  const normalized = value.trim();
  if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(normalized)) return 0;
  return Number(normalized);
}

function acceptedEncodingQualities(header: string): Map<string, number> {
  const qualities = new Map<string, number>();
  for (const entry of header.split(",")) {
    const [rawName, ...rawParameters] = entry.trim().toLowerCase().split(";");
    const name = rawName?.trim();
    if (!name) continue;
    const qualityParameter = rawParameters
      .map((parameter) => /^q\s*=\s*(.*)$/.exec(parameter.trim()))
      .find((match) => match !== null);
    qualities.set(name, parseQuality(qualityParameter?.[1]));
  }
  return qualities;
}

function negotiateContentEncoding(acceptEncoding: string | null): ContentEncodingNegotiation {
  if (!acceptEncoding?.trim()) {
    return { encoding: null, identityAcceptable: true };
  }

  const qualities = acceptedEncodingQualities(acceptEncoding);
  const hasWildcard = qualities.has("*");
  const wildcardQuality = qualities.get("*") ?? 0;
  const candidates = [
    { encoding: "br" as const, quality: qualities.get("br") ?? wildcardQuality },
    { encoding: "gzip" as const, quality: qualities.get("gzip") ?? wildcardQuality },
  ].filter((candidate) => candidate.quality > 0);

  candidates.sort((left, right) => right.quality - left.quality);
  const best = candidates[0];
  const explicitIdentityQuality = qualities.get("identity");
  const identityAcceptable =
    explicitIdentityQuality !== undefined
      ? explicitIdentityQuality > 0
      : !(hasWildcard && wildcardQuality === 0);

  if (!best) {
    return { encoding: null, identityAcceptable };
  }

  // Identity remains an allowed fallback when omitted, but it only expresses a
  // relative preference when the client assigns it an explicit quality.
  const identityQuality = explicitIdentityQuality ?? 0;
  return {
    encoding: best.quality >= identityQuality ? best.encoding : null,
    identityAcceptable,
  };
}

export function selectContentEncoding(
  acceptEncoding: string | null,
): SupportedContentEncoding | null {
  return negotiateContentEncoding(acceptEncoding).encoding;
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

function createCompressedBody(
  request: Request,
  responseBody: ReadableStream<Uint8Array>,
  encoding: SupportedContentEncoding,
): ReadableStream<Uint8Array> {
  const source = Readable.fromWeb(responseBody as unknown as NodeReadableStream);
  const compressor =
    encoding === "br" ? createBrotliCompress(BROTLI_OPTIONS) : createGzip(GZIP_OPTIONS);
  const body = Readable.toWeb(compressor) as ReadableStream<Uint8Array>;

  // `pipeline` propagates an upstream failure to the response body and tears
  // the source down when the consumer cancels. The request signal additionally
  // covers a client disconnect even if the runtime does not cancel the body.
  // The rejection is observed here; consumers still receive the same stream
  // error through `body`.
  void pipeline(source, compressor, { signal: request.signal }).catch(() => undefined);

  return body;
}

function notAcceptableResponse(headers: Headers): Response {
  for (const name of [
    "Accept-Ranges",
    "Content-Encoding",
    "Content-Length",
    "Content-MD5",
    "Content-Range",
    "Content-Type",
    "Digest",
    "ETag",
    "Last-Modified",
  ]) {
    headers.delete(name);
  }
  return new Response(null, {
    status: 406,
    statusText: "Not Acceptable",
    headers,
  });
}

/**
 * Compress eligible GET responses while preserving streaming and security
 * headers. Server actions, ranges, already encoded bodies and `no-transform`
 * responses are deliberately left untouched.
 */
export function compressHttpResponse(request: Request, response: Response): Response {
  if (!canCompressResponse(request, response)) return response;
  const responseBody = response.body;
  if (responseBody === null) return response;

  const headers = new Headers(response.headers);
  appendVary(headers, "Accept-Encoding");
  const { encoding, identityAcceptable } = negotiateContentEncoding(
    request.headers.get("accept-encoding"),
  );
  if (!encoding) {
    if (!identityAcceptable) return notAcceptableResponse(headers);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const body = createCompressedBody(request, responseBody, encoding);

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
