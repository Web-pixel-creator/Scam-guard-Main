import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { digestWebOcrImage } from "./web-ocr-image-digest";

describe("web OCR exact canonical-image digest", () => {
  it.each(["png", "jpeg", "webp"])("hashes canonical %s using SHA-256", async (type) => {
    const image = `data:image/${type};base64,AAAA`;
    const digest = await digestWebOcrImage(image);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(createHash("sha256").update(image, "utf8").digest("hex"));
    expect(await digestWebOcrImage(image)).toBe(digest);
  });

  it("uses the same allowed parser canonicalization on client and server", async () => {
    expect(await digestWebOcrImage(" \nDATA:IMAGE/PNG;BASE64,AA \nAA\t ")).toBe(
      await digestWebOcrImage("data:image/png;base64,AAAA"),
    );
  });

  it("does not lowercase base64 bytes or conflate MIME types", async () => {
    const original = await digestWebOcrImage("data:image/png;base64,AAAA");
    expect(await digestWebOcrImage("data:image/png;base64,aaaa")).not.toBe(original);
    expect(await digestWebOcrImage("data:image/jpeg;base64,AAAA")).not.toBe(original);
    expect(await digestWebOcrImage("data:image/png;base64,AAAB")).not.toBe(original);
  });

  it.each([
    "",
    "https://example.com/image.png",
    "data:image/svg+xml;base64,AAAA",
    "data:text/plain;base64,AAAA",
    "data:image/png;base64,AAA",
    "data:image/png;base64,****",
    `data:image/png;base64,${"A".repeat(5_600_000)}`,
  ])("rejects invalid or oversized input without including it in errors (%#)", async (image) => {
    await expect(digestWebOcrImage(image)).rejects.toThrow(/^invalid_image_data_url$/);
  });
});
