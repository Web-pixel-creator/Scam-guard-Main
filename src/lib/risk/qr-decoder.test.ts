import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import { encode as encodeJpeg } from "jpeg-js";
import { decodeQrFromDataUrl } from "./qr-decoder";

async function qrPngDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
  });
}

async function qrJpegDataUrl(value: string): Promise<string> {
  const pngDataUrl = await qrPngDataUrl(value);
  const png = PNG.sync.read(Buffer.from(pngDataUrl.split(",")[1], "base64"));
  const jpeg = encodeJpeg({ data: png.data, width: png.width, height: png.height }, 90);
  return `data:image/jpeg;base64,${jpeg.data.toString("base64")}`;
}

function oversizedPngHeaderDataUrl(): string {
  const bytes = Buffer.alloc(33);
  bytes.writeUInt32BE(0x89504e47, 0);
  bytes.writeUInt32BE(0x0d0a1a0a, 4);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(7000, 16);
  bytes.writeUInt32BE(7000, 20);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function blankPngDataUrl(width: number, height: number): string {
  const png = new PNG({ width, height });
  png.data.fill(255);
  const bytes = PNG.sync.write(png, { colorType: 6 });
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

describe("QR decoder", () => {
  it("decodes a real QR PNG data URL", async () => {
    const dataUrl = await qrPngDataUrl("https://kapitalbank.uz.evil.top/login");
    const result = await decodeQrFromDataUrl(dataUrl);

    expect(result.values).toContain("https://kapitalbank.uz.evil.top/login");
    expect(result.urls).toContain("https://kapitalbank.uz.evil.top/login");
  });

  it("decodes a real QR JPEG data URL", async () => {
    const dataUrl = await qrJpegDataUrl("https://example.com/menu");
    const result = await decodeQrFromDataUrl(dataUrl);

    expect(result.values).toContain("https://example.com/menu");
    expect(result.urls).toContain("https://example.com/menu");
  });

  it("fails closed for malformed or unsupported data URLs", async () => {
    await expect(decodeQrFromDataUrl("not a data url")).resolves.toEqual({
      values: [],
      urls: [],
    });
    await expect(decodeQrFromDataUrl("data:image/webp;base64,AAAA")).resolves.toEqual({
      values: [],
      urls: [],
    });
  });

  it("fails closed before decoding oversized PNG dimensions", async () => {
    await expect(decodeQrFromDataUrl(oversizedPngHeaderDataUrl())).resolves.toEqual({
      values: [],
      urls: [],
    });
  });

  it("fails closed before base64 decoding oversized data URLs", async () => {
    const oversized = `data:image/png;base64,${"A".repeat(9_000_000)}`;
    await expect(decodeQrFromDataUrl(oversized)).resolves.toEqual({ values: [], urls: [] });
  });

  it("returns control to the event loop before processing a high-resolution image", async () => {
    const input = blankPngDataUrl(2000, 1800);
    const startedAt = performance.now();
    const resultPromise = Promise.resolve(decodeQrFromDataUrl(input));
    const synchronousElapsedMs = performance.now() - startedAt;

    expect(synchronousElapsedMs).toBeLessThan(100);
    await expect(resultPromise).resolves.toEqual({ values: [], urls: [] });
  }, 10_000);

  it("keeps the per-process QR worker backlog bounded", async () => {
    const dataUrl = await qrPngDataUrl("https://example.com/bounded-queue");
    const results = await Promise.all(
      Array.from({ length: 5 }, () => decodeQrFromDataUrl(dataUrl)),
    );

    expect(
      results.filter((result) => result.urls.includes("https://example.com/bounded-queue")),
    ).toHaveLength(4);
    expect(results.filter((result) => result.values.length === 0)).toHaveLength(1);
  });
});
