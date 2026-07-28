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
