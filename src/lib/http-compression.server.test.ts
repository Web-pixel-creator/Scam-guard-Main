import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { compressHttpResponse, selectContentEncoding } from "./http-compression.server";

const LARGE_TEXT = "Ishonch Guard xavfsizlik tekshiruvi. ".repeat(200);

function textResponse(headers: HeadersInit = {}): Response {
  return new Response(LARGE_TEXT, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

async function compressedBytes(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

describe("HTTP content encoding negotiation", () => {
  it("prefers Brotli when quality values are equal", () => {
    expect(selectContentEncoding("gzip, deflate, br")).toBe("br");
  });

  it("honours quality values and explicit exclusions", () => {
    expect(selectContentEncoding("br;q=0.3, gzip;q=0.8")).toBe("gzip");
    expect(selectContentEncoding("br;q=0, gzip;q=0")).toBeNull();
    expect(selectContentEncoding("br;q=0.3, identity;q=0.8")).toBeNull();
    expect(selectContentEncoding("identity")).toBeNull();
    expect(selectContentEncoding("br;q=0.8junk, gzip;q=0.4")).toBe("gzip");
  });

  it("supports wildcard negotiation without overriding explicit exclusions", () => {
    expect(selectContentEncoding("*;q=0.5")).toBe("br");
    expect(selectContentEncoding("identity;q=0, *;q=0.5")).toBe("br");
    expect(selectContentEncoding("identity;q=0, br;q=0, *;q=0.5")).toBe("gzip");
  });
});

describe("HTTP response compression", () => {
  it("streams Brotli HTML and preserves response metadata", async () => {
    const request = new Request("https://ishonch.example/", {
      headers: { "accept-encoding": "br, gzip" },
    });
    const response = textResponse({
      "content-length": String(Buffer.byteLength(LARGE_TEXT)),
      "content-security-policy": "default-src 'self'",
      etag: '"strong-tag"',
      vary: "Origin",
    });

    const compressed = compressHttpResponse(request, response);
    const bytes = await compressedBytes(compressed);

    expect(compressed.headers.get("content-encoding")).toBe("br");
    expect(compressed.headers.get("content-length")).toBeNull();
    expect(compressed.headers.get("content-security-policy")).toBe("default-src 'self'");
    expect(compressed.headers.get("etag")).toBe('W/"strong-tag"');
    expect(compressed.headers.get("vary")).toBe("Origin, Accept-Encoding");
    expect(brotliDecompressSync(bytes).toString("utf8")).toBe(LARGE_TEXT);
    expect(bytes.length).toBeLessThan(Buffer.byteLength(LARGE_TEXT));
  });

  it("streams gzip when the client prefers gzip", async () => {
    const request = new Request("https://ishonch.example/", {
      headers: { "accept-encoding": "gzip;q=1, br;q=0.5" },
    });
    const compressed = compressHttpResponse(request, textResponse());
    const bytes = await compressedBytes(compressed);

    expect(compressed.headers.get("content-encoding")).toBe("gzip");
    expect(gunzipSync(bytes).toString("utf8")).toBe(LARGE_TEXT);
  });

  it("varies eligible identity responses by Accept-Encoding", () => {
    const request = new Request("https://ishonch.example/");
    const response = compressHttpResponse(request, textResponse());

    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("vary")).toBe("Accept-Encoding");
  });

  it.each(["br;q=0, gzip;q=0, identity;q=0", "deflate;q=1, identity;q=0", "identity;q=0, *;q=0"])(
    "returns 406 when no available representation is acceptable: %s",
    (acceptEncoding) => {
      const request = new Request("https://ishonch.example/", {
        headers: { "accept-encoding": acceptEncoding },
      });
      const response = textResponse({
        "content-length": String(Buffer.byteLength(LARGE_TEXT)),
        "content-security-policy": "default-src 'self'",
        etag: '"representation-tag"',
      });

      const result = compressHttpResponse(request, response);

      expect(result.status).toBe(406);
      expect(result.statusText).toBe("Not Acceptable");
      expect(result.body).toBeNull();
      expect(result.headers.get("vary")).toBe("Accept-Encoding");
      expect(result.headers.get("content-security-policy")).toBe("default-src 'self'");
      expect(result.headers.get("content-type")).toBeNull();
      expect(result.headers.get("content-length")).toBeNull();
      expect(result.headers.get("etag")).toBeNull();
    },
  );

  it("keeps identity available by default when only supported codings are excluded", () => {
    const request = new Request("https://ishonch.example/", {
      headers: { "accept-encoding": "br;q=0, gzip;q=0" },
    });

    const result = compressHttpResponse(request, textResponse());

    expect(result.status).toBe(200);
    expect(result.headers.get("content-encoding")).toBeNull();
  });

  it("propagates an upstream body failure to the compressed response consumer", async () => {
    const upstreamError = new Error("synthetic upstream failure");
    let sourceController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const sourceBody = new ReadableStream<Uint8Array>({
      start(controller) {
        sourceController = controller;
        controller.enqueue(new TextEncoder().encode(LARGE_TEXT));
      },
    });
    const request = new Request("https://ishonch.example/", {
      headers: { "accept-encoding": "gzip" },
    });
    const result = compressHttpResponse(
      request,
      new Response(sourceBody, { headers: { "content-type": "text/plain" } }),
    );
    const reader = result.body?.getReader();

    expect(reader).toBeDefined();
    await expect(reader?.read()).resolves.toMatchObject({ done: false });
    sourceController?.error(upstreamError);
    await expect(reader?.read()).rejects.toThrow("synthetic upstream failure");
  });

  it("cancels the upstream body when the compressed response consumer cancels", async () => {
    let observeCancellation: ((reason: unknown) => void) | undefined;
    const cancellationObserved = new Promise<unknown>((resolve) => {
      observeCancellation = resolve;
    });
    const sourceBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(LARGE_TEXT));
      },
      cancel(reason) {
        observeCancellation?.(reason);
      },
    });
    const request = new Request("https://ishonch.example/", {
      headers: { "accept-encoding": "gzip" },
    });
    const result = compressHttpResponse(
      request,
      new Response(sourceBody, { headers: { "content-type": "text/plain" } }),
    );
    const reader = result.body?.getReader();
    const cancellationReason = new Error("consumer stopped reading");

    expect(reader).toBeDefined();
    await expect(reader?.read()).resolves.toMatchObject({ done: false });
    await reader?.cancel(cancellationReason);
    await expect(cancellationObserved).resolves.toBe(cancellationReason);
  });

  it("aborts compression and its upstream body when the request is aborted", async () => {
    let observeCancellation: ((reason: unknown) => void) | undefined;
    const cancellationObserved = new Promise<unknown>((resolve) => {
      observeCancellation = resolve;
    });
    const sourceBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(LARGE_TEXT));
      },
      cancel(reason) {
        observeCancellation?.(reason);
      },
    });
    const requestAbort = new AbortController();
    const request = new Request("https://ishonch.example/", {
      headers: { "accept-encoding": "gzip" },
      signal: requestAbort.signal,
    });
    const result = compressHttpResponse(
      request,
      new Response(sourceBody, { headers: { "content-type": "text/plain" } }),
    );
    const reader = result.body?.getReader();

    expect(reader).toBeDefined();
    await expect(reader?.read()).resolves.toMatchObject({ done: false });
    requestAbort.abort();
    await expect(reader?.read()).rejects.toMatchObject({
      name: "AbortError",
      code: "ABORT_ERR",
    });
    await expect(cancellationObserved).resolves.toMatchObject({
      name: "AbortError",
      code: "ABORT_ERR",
    });
  });

  it.each([
    {
      name: "non-GET request",
      request: new Request("https://ishonch.example/", {
        method: "POST",
        headers: { "accept-encoding": "br" },
      }),
      response: textResponse(),
    },
    {
      name: "range request",
      request: new Request("https://ishonch.example/", {
        headers: { "accept-encoding": "br", range: "bytes=0-100" },
      }),
      response: textResponse(),
    },
    {
      name: "request no-transform directive",
      request: new Request("https://ishonch.example/", {
        headers: { "accept-encoding": "br", "cache-control": "no-transform" },
      }),
      response: textResponse(),
    },
    {
      name: "already encoded response",
      request: new Request("https://ishonch.example/", {
        headers: { "accept-encoding": "br" },
      }),
      response: textResponse({ "content-encoding": "gzip" }),
    },
    {
      name: "no-transform response",
      request: new Request("https://ishonch.example/", {
        headers: { "accept-encoding": "br" },
      }),
      response: textResponse({ "cache-control": "private, no-transform" }),
    },
    {
      name: "response that sets a cookie",
      request: new Request("https://ishonch.example/", {
        headers: { "accept-encoding": "br" },
      }),
      response: textResponse({ "set-cookie": "session=opaque; Secure; HttpOnly" }),
    },
    {
      name: "attachment response",
      request: new Request("https://ishonch.example/", {
        headers: { "accept-encoding": "br" },
      }),
      response: textResponse({ "content-disposition": 'attachment; filename="report.txt"' }),
    },
    {
      name: "small response with a known length",
      request: new Request("https://ishonch.example/", {
        headers: { "accept-encoding": "br" },
      }),
      response: new Response("ok", {
        headers: { "content-type": "text/plain", "content-length": "2" },
      }),
    },
    {
      name: "binary response",
      request: new Request("https://ishonch.example/", {
        headers: { "accept-encoding": "br" },
      }),
      response: new Response(new Uint8Array(2_048), {
        headers: { "content-type": "image/png" },
      }),
    },
  ])("does not transform a $name", ({ request, response }) => {
    const result = compressHttpResponse(request, response);
    expect(result).toBe(response);
  });
});
