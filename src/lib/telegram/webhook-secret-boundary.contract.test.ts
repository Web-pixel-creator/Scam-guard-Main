import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Telegram webhook secret comparison contract", () => {
  it("retains a fixed-length timing-safe comparison instead of string equality", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "lib", "telegram", "webhook.server.ts"),
      "utf8",
    );

    expect(source).toContain('import { createHash, timingSafeEqual } from "node:crypto"');
    expect(source.match(/createHash\("sha256"\)/gu)).toHaveLength(2);
    expect(source).toContain("timingSafeEqual(actualDigest, expectedDigest)");
    expect(source).not.toMatch(/header\s*!==\s*secret/u);
  });
});
