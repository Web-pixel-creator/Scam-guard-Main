import { describe, expect, it } from "vitest";
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

describe("QR decoder", () => {
  it("decodes a real QR PNG data URL", async () => {
    const dataUrl = await qrPngDataUrl("https://kapitalbank.uz.evil.top/login");
    const result = decodeQrFromDataUrl(dataUrl);

    expect(result.values).toContain("https://kapitalbank.uz.evil.top/login");
    expect(result.urls).toContain("https://kapitalbank.uz.evil.top/login");
  });

  it("decodes a real QR JPEG data URL", async () => {
    const dataUrl = await qrJpegDataUrl("https://example.com/menu");
    const result = decodeQrFromDataUrl(dataUrl);

    expect(result.values).toContain("https://example.com/menu");
    expect(result.urls).toContain("https://example.com/menu");
  });

  it("fails closed for malformed or unsupported data URLs", () => {
    expect(decodeQrFromDataUrl("not a data url")).toEqual({ values: [], urls: [] });
    expect(decodeQrFromDataUrl("data:image/webp;base64,AAAA")).toEqual({ values: [], urls: [] });
  });

  it("fails closed before decoding oversized PNG dimensions", () => {
    expect(decodeQrFromDataUrl(oversizedPngHeaderDataUrl())).toEqual({ values: [], urls: [] });
  });

  it("fails closed before base64 decoding oversized data URLs", () => {
    const oversized = `data:image/png;base64,${"A".repeat(9_000_000)}`;
    expect(decodeQrFromDataUrl(oversized)).toEqual({ values: [], urls: [] });
  });
});
